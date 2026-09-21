'use client';

import { useState } from 'react';
import { fieldErrors, inquirySchema } from '@/lib/booking/validation';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export function InquiryForm({ propertySlug }: { propertySlug?: string }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;

    const form = new FormData(event.currentTarget);
    const parsed = inquirySchema.safeParse({
      name: form.get('name'),
      email: form.get('email'),
      message: form.get('message'),
      arrival: form.get('arrival') || undefined,
      departure: form.get('departure') || undefined,
      company: form.get('company') || undefined,
      propertySlug,
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setStatus('sending');

    try {
      const response = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      setStatus(response.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <Alert tone="info" title="Message sent">
        We read everything ourselves and usually reply within a few hours — sooner during
        the day.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {status === 'error' ? (
        <Alert tone="critical">
          That did not send. Please try again, or email us directly.
        </Alert>
      ) : null}

      <TextField label="Your name" name="name" autoComplete="name" required error={errors.name} />
      <TextField
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        error={errors.email}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Arriving (optional)" name="arrival" type="date" error={errors.arrival} />
        <TextField
          label="Leaving (optional)"
          name="departure"
          type="date"
          error={errors.departure}
        />
      </div>

      <TextAreaField
        label="What can we help with?"
        name="message"
        required
        error={errors.message}
        hint="Who is coming, roughly when, and anything that would make or break it."
      />

      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </Button>
    </form>
  );
}
