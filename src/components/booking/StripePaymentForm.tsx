'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { useMemo, useState } from 'react';
import type { Money } from '@/lib/util/money';
import { formatMoney } from '@/lib/util/money';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

/**
 * On-site card capture with Stripe's Payment Element.
 *
 * The element is an iframe served by Stripe: card numbers go straight from the
 * guest's browser to Stripe against the client secret and never reach this
 * origin, which keeps PCI scope at SAQ A while the checkout still looks and
 * behaves like part of the site.
 */

// `loadStripe` returns a promise that must be created once per key, not per
// render, or the Elements provider remounts and loses the entered card.
const stripeCache = new Map<string, Promise<Stripe | null>>();

function stripePromiseFor(key: string): Promise<Stripe | null> {
  let promise = stripeCache.get(key);
  if (!promise) {
    promise = loadStripe(key);
    stripeCache.set(key, promise);
  }
  return promise;
}

export type StripePaymentFormProps = {
  publishableKey: string;
  clientSecret: string;
  amount: Money;
  /** Called with the PaymentIntent id once Stripe reports success. */
  onPaid: (paymentIntentId: string) => void | Promise<void>;
  returnUrl: string;
};

export function StripePaymentForm(props: StripePaymentFormProps) {
  const stripePromise = useMemo(
    () => stripePromiseFor(props.publishableKey),
    [props.publishableKey],
  );

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        // Match the site rather than Stripe's defaults — a checkout that looks
        // borrowed is a checkout guests abandon.
        appearance: {
          theme: 'flat',
          variables: {
            colorPrimary: '#5c3d2e',
            colorBackground: '#ffffff',
            colorText: '#2b2420',
            colorDanger: '#b3261e',
            fontFamily: 'var(--font-body), system-ui, sans-serif',
            fontSizeBase: '15px',
            borderRadius: '4px',
            spacingUnit: '4px',
          },
          rules: {
            '.Input': { border: '1px solid #d8d2c8', boxShadow: 'none' },
            '.Input:focus': { border: '1px solid #5c3d2e', boxShadow: '0 0 0 1px #5c3d2e' },
            '.Label': { fontWeight: '500', fontSize: '13px' },
          },
        },
      }}
    >
      <PaymentFields {...props} />
    </Elements>
  );
}

function PaymentFields({ amount, onPaid, returnUrl }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setError(null);

    // `redirect: 'if_required'` keeps cards on-page while still supporting
    // methods that must leave the site (3-D Secure, bank redirects).
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message ?? 'That payment could not be completed.');
      setSubmitting(false);
      return;
    }

    const intent = result.paymentIntent;
    if (!intent) {
      setError('We lost track of that payment. Please check your email before retrying.');
      setSubmitting(false);
      return;
    }

    if (intent.status === 'succeeded' || intent.status === 'processing') {
      await onPaid(intent.id);
      return;
    }

    setError('That payment needs another step. Please try a different card.');
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={{ layout: 'tabs' }} />

      {error ? <Alert tone="critical">{error}</Alert> : null}

      <Button type="submit" size="lg" className="w-full" disabled={!stripe || submitting}>
        {submitting ? 'Processing…' : `Pay ${formatMoney(amount)}`}
      </Button>

      <p className="text-center text-xs leading-relaxed text-[var(--color-ink-faint)]">
        Payments are processed by Stripe. Your card details are never sent to,
        or stored on, this website.
      </p>
    </form>
  );
}
