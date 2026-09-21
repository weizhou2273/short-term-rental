import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyDraft } from '@/lib/booking/draft';
import { confirmDraft } from '@/lib/booking/confirm';
import { resolvePaymentProvider } from '@/lib/payments';
import { apiError, unexpectedError, validationError } from '@/lib/api/respond';
import { clientKey, rateLimit } from '@/lib/api/rate-limit';

/**
 * Step two of checkout: the guest's browser reports that payment finished.
 *
 * The browser's claim is never taken at face value. The draft's signature is
 * checked, then the payment is verified directly with the provider, and only a
 * genuinely succeeded payment of at least the amount that was quoted produces a
 * reservation. The webhook does the same thing independently, so a guest who
 * closes the tab still gets booked.
 */
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  draft: z.string().min(16).max(4_096),
  paymentIntentId: z.string().min(4).max(255),
});

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, 'confirm'), 20, 5 * 60_000);
  if (!limit.ok) {
    return apiError('Too many attempts. Please wait a moment.', 429, {
      retryAfter: limit.retryAfter,
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError('Expected a JSON body.', 400);
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return validationError(parsed.error);

  const verification = verifyDraft(parsed.data.draft);
  if (!verification.ok) {
    const message =
      verification.reason === 'expired'
        ? 'This checkout has expired. Please start again — you have not been charged.'
        : 'We could not verify this checkout. Please start again.';
    return apiError(message, 400);
  }

  const draft = verification.draft;

  try {
    const provider = resolvePaymentProvider();
    if (!provider) return apiError('Payments are not configured.', 503);

    const payment = await provider.verify(parsed.data.paymentIntentId);

    if (payment.status === 'processing') {
      return NextResponse.json({
        status: 'processing' as const,
        reference: draft.reference,
        message: 'Your payment is still clearing. We will email confirmation shortly.',
      });
    }

    if (payment.status !== 'succeeded') {
      return apiError(payment.message ?? 'That payment did not go through.', 402);
    }

    // The payment must belong to this draft and cover what was quoted.
    if (payment.reference && payment.reference !== draft.reference) {
      return apiError('That payment does not match this booking.', 409);
    }
    if (payment.amount.amount < draft.dueNowAmount) {
      return apiError('The payment did not cover the amount due.', 409);
    }

    const result = await confirmDraft(draft, `${payment.provider}:${payment.id}`);

    if (result.status === 'duplicate') {
      return NextResponse.json({ status: 'confirmed' as const, reference: draft.reference });
    }
    if (result.status === 'failed') {
      return NextResponse.json(
        { status: 'needs_attention' as const, reference: draft.reference, message: result.message },
        { status: 202 },
      );
    }

    return NextResponse.json({
      status: 'confirmed' as const,
      reference: result.booking.reference,
      booking: result.booking,
    });
  } catch (error) {
    return unexpectedError('booking/confirm', error);
  }
}
