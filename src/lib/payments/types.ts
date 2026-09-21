import type { Money } from '@/lib/util/money';
import type { GuestDetails } from '@/lib/booking/types';
import type { IsoDate } from '@/lib/util/date';

/**
 * One interface, two implementations. Stripe collects on-site with the Payment
 * Element; OwnerRez collects on its own hosted, PCI-compliant page. Swapping
 * between them is a config change, not a code change, which is what makes it
 * safe to launch on OwnerRez and move to Stripe later without touching the
 * booking flow.
 */

export type PaymentProviderId = 'stripe' | 'ownerrez';

/**
 * `embedded` providers hand back a client secret and the guest pays without
 * leaving the site. `redirect` providers hand back a URL to send them to.
 */
export type PaymentMode = 'embedded' | 'redirect';

export type PaymentIntentInput = {
  /** Charged now. The stay balance, if any, is collected later by OwnerRez. */
  amount: Money;
  /** Full stay total, recorded as metadata for reconciliation. */
  stayTotal: Money;
  propertyId: number;
  propertySlug: string;
  propertyName: string;
  arrival: IsoDate;
  departure: IsoDate;
  guest: GuestDetails;
  /** Our booking reference, threaded through to the provider for matching. */
  reference: string;
  /**
   * Signed booking draft, stored with the payment so the webhook can create the
   * reservation without any further state of our own.
   */
  draftToken?: string;
  /** Where to send the guest after a redirect checkout. */
  returnUrl: string;
};

export type PaymentIntent = {
  provider: PaymentProviderId;
  mode: PaymentMode;
  /** Provider-side id (Stripe PaymentIntent id, OwnerRez payment id). */
  id: string;
  /** Present for `embedded` providers. */
  clientSecret?: string;
  /** Present for `redirect` providers. */
  redirectUrl?: string;
  amount: Money;
  /** Publishable key for the client SDK, when the provider needs one. */
  publishableKey?: string;
};

export type PaymentStatus = 'succeeded' | 'processing' | 'requires_action' | 'failed';

export type PaymentVerification = {
  status: PaymentStatus;
  provider: PaymentProviderId;
  id: string;
  amount: Money;
  reference: string | null;
  /** Human-readable reason when `status` is `failed`. */
  message?: string;
};

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly mode: PaymentMode;
  readonly label: string;
  createIntent(input: PaymentIntentInput): Promise<PaymentIntent>;
  /**
   * Confirms with the provider that money actually moved. Called before a
   * reservation is created — never trust the client's word for it.
   */
  verify(intentId: string): Promise<PaymentVerification>;
}

export class PaymentError extends Error {
  readonly provider: PaymentProviderId;
  readonly retryable: boolean;

  constructor(message: string, provider: PaymentProviderId, retryable = false) {
    super(message);
    this.name = 'PaymentError';
    this.provider = provider;
    this.retryable = retryable;
  }
}
