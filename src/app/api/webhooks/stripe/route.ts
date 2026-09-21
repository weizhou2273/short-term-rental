import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { env } from '@/lib/config/env';
import { stripeClient } from '@/lib/payments/stripe';
import { verifyDraft } from '@/lib/booking/draft';
import { confirmDraft } from '@/lib/booking/confirm';
import { unchunkToken } from '@/lib/payments/metadata';

/**
 * Stripe webhook — the authoritative confirmation path.
 *
 * The browser round-trip in `/api/booking/confirm` is a convenience; this is
 * what guarantees a paid guest ends up with a reservation even if they close
 * the tab, lose signal, or the redirect never completes. Both paths are
 * idempotent on the booking reference, so whichever arrives second is absorbed.
 *
 * The raw body is required for signature verification, so this route must not
 * let anything parse or re-encode it first.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[stripe] webhook received but STRIPE_WEBHOOK_SECRET is unset');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(raw, signature, secret);
  } catch (error) {
    // An invalid signature means the request did not come from Stripe. Say as
    // little as possible about why.
    console.error('[stripe] signature verification failed', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        await onPaymentSucceeded(event.data.object);
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        console.warn(
          `[stripe] payment failed for ${intent.metadata?.reference ?? intent.id}:`,
          intent.last_payment_error?.message,
        );
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object;
        // Refunds are reconciled by a human: cancelling in OwnerRez has guest
        // and calendar consequences that should not happen automatically.
        console.info(`[stripe] refund recorded for charge ${charge.id}`);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    // Returning 500 asks Stripe to retry, which is what we want for a transient
    // failure part-way through creating the reservation.
    console.error(`[stripe] handler failed for ${event.type}`, error);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function onPaymentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
  const token = unchunkToken('draft', intent.metadata);
  const reference = intent.metadata?.reference;

  if (!token) {
    // Payments started outside the booking flow (a manual charge, a balance
    // payment taken in the Stripe dashboard) carry no draft and are not ours.
    console.info(`[stripe] ${intent.id} has no booking draft; nothing to confirm`);
    return;
  }

  const verification = verifyDraft(token);
  if (!verification.ok) {
    console.error(
      `[stripe] draft on ${intent.id} (${reference ?? 'no reference'}) failed verification: ${verification.reason}`,
    );
    return;
  }

  const result = await confirmDraft(verification.draft, `stripe:${intent.id}`);
  if (result.status === 'failed') {
    // Throwing makes Stripe retry with backoff, which is the right behaviour
    // for a guest who has paid but is not yet booked.
    throw new Error(`Could not confirm ${verification.draft.reference}: ${result.message}`);
  }
}
