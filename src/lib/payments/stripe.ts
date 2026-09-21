import 'server-only';
import Stripe from 'stripe';
import { env } from '@/lib/config/env';
import { money } from '@/lib/util/money';
import { chunkToken } from './metadata';
import { PaymentError, type PaymentIntent, type PaymentIntentInput, type PaymentProvider, type PaymentStatus, type PaymentVerification } from './types';

let client: Stripe | null = null;

export function stripeClient(): Stripe {
  if (client) return client;
  const key = env().STRIPE_SECRET_KEY;
  if (!key) throw new PaymentError('STRIPE_SECRET_KEY is not set', 'stripe');
  client = new Stripe(key, {
    // Pinning the version keeps a Stripe-side upgrade from changing our
    // payloads underneath us.
    apiVersion: '2026-08-26.dahlia',
    appInfo: { name: 'Aerie direct booking', version: '1.0.0' },
    maxNetworkRetries: 2,
  });
  return client;
}

function mapStatus(status: Stripe.PaymentIntent.Status): PaymentStatus {
  switch (status) {
    case 'succeeded':
      return 'succeeded';
    case 'processing':
      return 'processing';
    case 'requires_action':
    case 'requires_confirmation':
    case 'requires_payment_method':
      return 'requires_action';
    default:
      return 'failed';
  }
}

/**
 * On-site checkout with the Stripe Payment Element. Card details never touch
 * our server — the browser sends them straight to Stripe against a client
 * secret, so PCI scope stays at SAQ A.
 */
export const stripeProvider: PaymentProvider = {
  id: 'stripe',
  mode: 'embedded',
  label: 'Card, Apple Pay or Google Pay',

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    const stripe = stripeClient();
    try {
      const intent = await stripe.paymentIntents.create(
        {
          amount: input.amount.amount,
          currency: input.amount.currency.toLowerCase(),
          automatic_payment_methods: { enabled: true },
          receipt_email: input.guest.email,
          description: `${input.propertyName} · ${input.arrival} → ${input.departure}`,
          statement_descriptor_suffix: 'STAY',
          metadata: {
            reference: input.reference,
            property_id: String(input.propertyId),
            property_slug: input.propertySlug,
            arrival: input.arrival,
            departure: input.departure,
            guest_email: input.guest.email,
            guest_name: `${input.guest.firstName} ${input.guest.lastName}`,
            stay_total: String(input.stayTotal.amount),
            // Split across numbered keys: Stripe caps a value at 500 chars.
            ...(input.draftToken ? chunkToken('draft', input.draftToken) : {}),
          },
        },
        // Idempotent on our booking reference: a double-submitted checkout
        // returns the same intent instead of charging twice.
        { idempotencyKey: `booking:${input.reference}` },
      );

      if (!intent.client_secret) {
        throw new PaymentError('Stripe returned no client secret', 'stripe', true);
      }

      return {
        provider: 'stripe',
        mode: 'embedded',
        id: intent.id,
        clientSecret: intent.client_secret,
        amount: money(intent.amount, intent.currency),
        publishableKey: env().NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      };
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      const stripeError = error as Stripe.errors.StripeError;
      throw new PaymentError(
        stripeError?.message ?? 'Could not start the payment',
        'stripe',
        stripeError?.type === 'StripeConnectionError' ||
          stripeError?.type === 'StripeAPIError',
      );
    }
  },

  async verify(intentId: string): Promise<PaymentVerification> {
    const stripe = stripeClient();
    const intent = await stripe.paymentIntents.retrieve(intentId);
    return {
      status: mapStatus(intent.status),
      provider: 'stripe',
      id: intent.id,
      amount: money(intent.amount_received || intent.amount, intent.currency),
      reference: intent.metadata?.reference ?? null,
      message: intent.last_payment_error?.message,
    };
  },
};
