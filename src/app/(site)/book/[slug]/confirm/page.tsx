import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { verifyDraft } from '@/lib/booking/draft';
import { confirmDraft } from '@/lib/booking/confirm';
import { resolvePaymentProvider } from '@/lib/payments';
import { pageMetadata } from '@/lib/config/metadata';

/**
 * Landing point for redirect-based checkout (OwnerRez hosted payment, and any
 * Stripe payment method that leaves the site for 3-D Secure or a bank).
 *
 * The guest arrives here with only URL parameters, so nothing in them is
 * trusted: the draft's signature is checked and the payment is verified
 * directly with the provider before a reservation is created. The relevant
 * webhook does the same thing independently, so a guest who never makes it back
 * still gets booked.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Confirming your booking',
  description: '',
  path: '/book',
  noIndex: true,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function done(reference: string, status: string): never {
  redirect(
    `/booking/confirmation?reference=${encodeURIComponent(reference)}&status=${status}`,
  );
}

export default async function RedirectConfirmPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const reference = first(query.reference) ?? '';
  const token = first(query.draft);

  // Providers disagree on the parameter name for the completed payment.
  const paymentId =
    first(query.payment_intent) ??
    first(query.payment_id) ??
    first(query.paymentId) ??
    first(query.id);

  if (!token || !paymentId) done(reference, 'needs_attention');

  const verification = verifyDraft(token);
  if (!verification.ok) done(reference, 'needs_attention');

  const draft = verification.draft;
  const provider = resolvePaymentProvider();
  if (!provider) done(draft.reference, 'needs_attention');

  let status = 'needs_attention';
  try {
    const payment = await provider.verify(paymentId);

    if (payment.status === 'processing') {
      status = 'processing';
    } else if (payment.status !== 'succeeded') {
      status = 'failed';
    } else if (payment.amount.amount < draft.dueNowAmount) {
      // Underpaid: never create the reservation, and flag it for a human.
      console.error(
        `[booking] ${draft.reference} paid ${payment.amount.amount}, expected ${draft.dueNowAmount}`,
      );
    } else {
      const result = await confirmDraft(draft, `${payment.provider}:${payment.id}`);
      status = result.status === 'failed' ? 'needs_attention' : 'confirmed';
    }
  } catch (error) {
    console.error('[booking] redirect confirmation failed', error);
  }

  done(draft.reference, status);
}
