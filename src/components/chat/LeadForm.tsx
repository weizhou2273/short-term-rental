'use client';

import { type FormEvent, type RefObject, useState } from 'react';
import { SmsConsentBoxes } from '@/components/legal/SmsConsent';
import { isPhone, LEAD_LIMITS, NAME_PATTERN, NO_SMS_CONSENT } from '@/lib/chat/shared';

export type Guest = { name: string; email: string; phone: string; token: string | null };

/**
 * Name, email and phone, asked before the first question, with the two
 * optional text-message boxes under the phone field. /api/chat/lead emails
 * them to the host, adds the lead to Go High Level and returns the token the
 * chat sends with every message.
 */
export function LeadForm({
  initial,
  nameRef,
  onDone,
}: {
  initial: Guest | null;
  nameRef: RefObject<HTMLInputElement | null>;
  onDone: (guest: Guest) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  // The text-message boxes always start unticked, even for a returning guest.
  const [consent, setConsent] = useState(NO_SMS_CONSENT);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const details = { name: name.trim(), email: email.trim(), phone: phone.trim() };
    if (!NAME_PATTERN.test(details.name)) return setError('Please enter your name using letters only.');
    if (!isPhone(details.phone)) return setError('Please enter a phone number we can call or text, with area code.');
    setError(null);
    setSending(true);
    try {
      const res = await fetch('/api/chat/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...details, ...consent, page: window.location.pathname + window.location.search }),
      });
      const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!res.ok || !body.token) {
        setError(body.error || 'Couldn’t start the chat. Please try again, or contact us directly.');
        return;
      }
      onDone({ ...details, token: body.token });
    } catch {
      setError('Couldn’t reach us. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="chat-lead" onSubmit={submit}>
      <label className="chat-field">
        <span>Name</span>
        <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={LEAD_LIMITS.name} />
      </label>
      <label className="chat-field">
        <span>Email</span>
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          maxLength={LEAD_LIMITS.email}
        />
      </label>
      <label className="chat-field">
        <span>Phone</span>
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          required
          maxLength={LEAD_LIMITS.phone}
        />
      </label>
      <SmsConsentBoxes value={consent} onChange={setConsent} />
      {error ? (
        <p className="chat-lead-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-solid chat-lead-submit" disabled={sending}>
        {sending ? 'One moment…' : 'Start chat'}
      </button>
    </form>
  );
}
