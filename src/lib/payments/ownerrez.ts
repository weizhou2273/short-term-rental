import 'server-only';
import { z } from 'zod';
import { ownerRezRequest } from '@/lib/ownerrez/client';
import { fromMajorUnits, toMajorUnits } from '@/lib/util/money';
import {
  PaymentError,
  type PaymentIntent,
  type PaymentIntentInput,
  type PaymentProvider,
  type PaymentStatus,
  type PaymentVerification,
} from './types';

/**
 * OwnerRez-hosted checkout.
 *
 * OwnerRez issues a hosted payment page against a booking or quote; the guest
 * completes payment there and returns to us. Nothing sensitive crosses our
 * servers, which makes this the fastest route to a compliant live site — and a
 * sound fallback if Stripe is ever misconfigured.
 */

const hostedPaymentSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    url: z.string().url().nullish(),
    payment_url: z.string().url().nullish(),
    hosted_url: z.string().url().nullish(),
    status: z.string().nullish(),
    amount: z.number().nullish(),
    currency_code: z.string().nullish(),
  })
  .passthrough();

function mapStatus(status: string | null | undefined): PaymentStatus {
  const value = (status ?? '').toLowerCase();
  if (['paid', 'succeeded', 'completed', 'captured'].includes(value)) return 'succeeded';
  if (['pending', 'processing', 'authorized'].includes(value)) return 'processing';
  if (['created', 'open', 'requires_action', 'unpaid'].includes(value)) {
    return 'requires_action';
  }
  return 'failed';
}

export const ownerRezProvider: PaymentProvider = {
  id: 'ownerrez',
  mode: 'redirect',
  label: 'Secure checkout hosted by OwnerRez',

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    try {
      const raw = await ownerRezRequest<unknown>('/payments/hosted', {
        method: 'POST',
        body: {
          property_id: input.propertyId,
          amount: toMajorUnits(input.amount),
          currency_code: input.amount.currency,
          description: `${input.propertyName} · ${input.arrival} → ${input.departure}`,
          reference: input.reference,
          return_url: input.returnUrl,
          guest: {
            first_name: input.guest.firstName,
            last_name: input.guest.lastName,
            email: input.guest.email,
            phone: input.guest.phone,
          },
        },
        revalidate: 0,
      });

      const parsed = hostedPaymentSchema.safeParse(raw);
      if (!parsed.success) {
        throw new PaymentError('OwnerRez returned an unrecognised payment', 'ownerrez');
      }

      const redirectUrl =
        parsed.data.url ?? parsed.data.payment_url ?? parsed.data.hosted_url ?? null;
      if (!redirectUrl) {
        throw new PaymentError('OwnerRez returned no checkout URL', 'ownerrez');
      }

      return {
        provider: 'ownerrez',
        mode: 'redirect',
        id: String(parsed.data.id),
        redirectUrl,
        amount: input.amount,
      };
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      throw new PaymentError(
        error instanceof Error ? error.message : 'Could not start the payment',
        'ownerrez',
        true,
      );
    }
  },

  async verify(intentId: string): Promise<PaymentVerification> {
    const raw = await ownerRezRequest<unknown>(`/payments/${encodeURIComponent(intentId)}`, {
      revalidate: 0,
    });
    const parsed = hostedPaymentSchema.safeParse(raw);
    if (!parsed.success) {
      throw new PaymentError('Could not read the payment status', 'ownerrez', true);
    }
    return {
      status: mapStatus(parsed.data.status),
      provider: 'ownerrez',
      id: String(parsed.data.id),
      amount: fromMajorUnits(parsed.data.amount ?? 0, parsed.data.currency_code ?? 'USD'),
      reference: null,
    };
  },
};
