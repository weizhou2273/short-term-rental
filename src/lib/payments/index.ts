import 'server-only';
import { env, ownerRezConfigured, stripeConfigured } from '@/lib/config/env';
import { stripeProvider } from './stripe';
import { ownerRezProvider } from './ownerrez';
import type { PaymentProvider } from './types';

export * from './types';

/**
 * Resolves which provider takes the money.
 *
 * `auto` (the default) prefers Stripe when it is fully configured and falls
 * back to OwnerRez-hosted checkout otherwise, so a half-finished Stripe setup
 * degrades to a working checkout rather than a broken one. An explicit
 * `PAYMENT_PROVIDER` overrides the preference but still refuses to select a
 * provider whose credentials are missing.
 */
export function resolvePaymentProvider(): PaymentProvider | null {
  const preference = env().PAYMENT_PROVIDER;

  if (preference === 'stripe') return stripeConfigured() ? stripeProvider : null;
  if (preference === 'ownerrez') return ownerRezConfigured() ? ownerRezProvider : null;

  if (stripeConfigured()) return stripeProvider;
  if (ownerRezConfigured()) return ownerRezProvider;
  return null;
}

/**
 * True when no provider can take a payment. The checkout then collects the
 * booking as a request and tells the guest an invoice will follow, which is
 * also the behaviour on a fresh clone with no credentials at all.
 */
export function paymentsUnavailable(): boolean {
  return resolvePaymentProvider() === null;
}
