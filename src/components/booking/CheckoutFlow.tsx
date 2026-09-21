'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { GuestCount, Property, Quote } from '@/lib/booking/types';
import type { IsoDate } from '@/lib/util/date';
import { guestDetailsSchema } from '@/lib/booking/validation';
import { fieldErrors } from '@/lib/booking/validation';
import { money } from '@/lib/util/money';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { StripePaymentForm } from './StripePaymentForm';

type Stage =
  | { name: 'details' }
  | {
      name: 'payment';
      provider: 'stripe';
      clientSecret: string;
      publishableKey: string;
      draft: string;
      reference: string;
      quote: Quote;
    }
  | { name: 'finishing' };

/**
 * The two-stage checkout: guest details, then payment.
 *
 * Details are collected first and posted to `/api/booking`, which re-prices the
 * stay server-side and starts the payment. Only then is a card asked for — so a
 * guest is never shown a payment field for a price that turns out to be stale
 * or for dates that have just been taken.
 */
export function CheckoutFlow({
  property,
  arrival,
  departure,
  guests,
  quote,
}: {
  property: Property;
  arrival: IsoDate;
  departure: IsoDate;
  guests: GuestCount;
  quote: Quote;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ name: 'details' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function startPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = new FormData(event.currentTarget);
    const acceptedTerms = form.get('acceptedTerms') === 'on';

    const parsed = guestDetailsSchema.safeParse({
      firstName: form.get('firstName'),
      lastName: form.get('lastName'),
      email: form.get('email'),
      phone: form.get('phone'),
      notes: form.get('notes') || undefined,
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    if (!acceptedTerms) {
      setErrors({ acceptedTerms: 'Please accept the rental terms to continue.' });
      return;
    }

    setErrors({});
    setFormError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertySlug: property.slug,
          arrival,
          departure,
          guests,
          guest: parsed.data,
          acceptedTerms: true,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setErrors(payload.fields ?? {});
        setFormError(payload.error ?? 'We could not start this booking.');
        setSubmitting(false);
        return;
      }

      // No payment provider configured: the booking was taken as a request.
      if (payload.mode === 'request') {
        router.push(`/booking/confirmation?reference=${payload.reference}&mode=request`);
        return;
      }

      // Hosted checkout (OwnerRez): hand the guest over.
      if (payload.mode === 'redirect' && payload.redirectUrl) {
        window.location.href = payload.redirectUrl;
        return;
      }

      setStage({
        name: 'payment',
        provider: 'stripe',
        clientSecret: payload.clientSecret,
        publishableKey: payload.publishableKey,
        draft: payload.draft,
        reference: payload.reference,
        quote: payload.quote ?? quote,
      });
      setSubmitting(false);
    } catch {
      setFormError('We could not reach the server. Please check your connection.');
      setSubmitting(false);
    }
  }

  async function finishBooking(paymentIntentId: string, draft: string, reference: string) {
    setStage({ name: 'finishing' });
    try {
      const response = await fetch('/api/booking/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft, paymentIntentId }),
      });
      const payload = await response.json();

      // The card has been charged by this point, so every outcome other than a
      // hard failure still sends the guest to a confirmation they can keep. The
      // webhook completes anything left unfinished.
      const status =
        response.ok || response.status === 202 ? (payload.status ?? 'confirmed') : 'needs_attention';

      router.push(
        `/booking/confirmation?reference=${payload.reference ?? reference}&status=${status}`,
      );
    } catch {
      router.push(`/booking/confirmation?reference=${reference}&status=needs_attention`);
    }
  }

  if (stage.name === 'finishing') {
    return (
      <div className="py-16 text-center" aria-live="polite" aria-busy="true">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-line-strong)] border-t-[var(--color-ink)]" />
        <p className="mt-6 text-sm text-[var(--color-ink-muted)]">
          Confirming your reservation. Do not close this window.
        </p>
      </div>
    );
  }

  if (stage.name === 'payment') {
    return (
      <div>
        <h2 className="display mb-2 text-2xl">Payment</h2>
        <p className="mb-8 text-sm text-[var(--color-ink-muted)]">
          Reference {stage.reference}. You are paying the amount due today; any balance is
          charged automatically before arrival.
        </p>
        <StripePaymentForm
          publishableKey={stage.publishableKey}
          clientSecret={stage.clientSecret}
          amount={money(stage.quote.schedule.dueNow.amount, stage.quote.currency)}
          returnUrl={`${window.location.origin}/booking/confirmation?reference=${stage.reference}`}
          onPaid={(id) => finishBooking(id, stage.draft, stage.reference)}
        />
        <button
          type="button"
          onClick={() => setStage({ name: 'details' })}
          className="mt-6 text-xs text-[var(--color-ink-muted)] underline underline-offset-4 hover:text-[var(--color-ink)]"
        >
          Back to your details
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={startPayment} noValidate>
      <h2 className="display mb-8 text-2xl">Your details</h2>

      {formError ? (
        <Alert tone="critical" className="mb-6">
          {formError}
        </Alert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="First name"
          name="firstName"
          autoComplete="given-name"
          required
          error={errors.firstName}
        />
        <TextField
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          required
          error={errors.lastName}
        />
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <TextField
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          error={errors.email}
          hint="Your confirmation and directions go here."
        />
        <TextField
          label="Phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          error={errors.phone}
          hint="Only used if something needs sorting."
        />
      </div>

      <div className="mt-5">
        <TextAreaField
          label="Anything we should know?"
          name="notes"
          error={errors.notes}
          hint="Arrival time, dietary needs, an occasion we could mark."
        />
      </div>

      <label className="mt-7 flex cursor-pointer items-start gap-3 text-sm text-[var(--color-ink-muted)]">
        <input
          type="checkbox"
          name="acceptedTerms"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
        />
        <span>
          I have read and accept the{' '}
          <Link
            href="/terms"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-ink)] underline decoration-[var(--color-line-strong)] underline-offset-4 hover:decoration-[var(--color-accent)]"
          >
            rental terms
          </Link>
          , including the cancellation schedule.
        </span>
      </label>
      {errors.acceptedTerms ? (
        <p role="alert" className="mt-2 text-xs font-medium text-[var(--color-critical)]">
          {errors.acceptedTerms}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="mt-8 w-full" disabled={submitting}>
        {submitting ? 'Checking availability…' : 'Continue to payment'}
      </Button>

      <p className="mt-3 text-center text-xs text-[var(--color-ink-faint)]">
        We confirm the dates are still free before asking for any card details.
      </p>
    </form>
  );
}
