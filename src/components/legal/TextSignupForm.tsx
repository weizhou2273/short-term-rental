'use client';

import Link from 'next/link';
import { useState } from 'react';
import { type Guest, LeadForm } from '@/components/chat/LeadForm';
import { firstName, GUEST_KEY } from '@/lib/chat/shared';
import { trackGa } from '@/lib/google-analytics';
import { trackMeta } from '@/lib/meta-pixel';

/**
 * The form on /text-signup: the chat's sign-in form (name, email, phone and
 * the two optional text-message boxes) in the page body, sent to the same
 * place. The details are kept for the chat, so the guest isn't asked again.
 */
export function TextSignupForm() {
  const [done, setDone] = useState<Guest | null>(null);

  function onDone(guest: Guest) {
    try {
      localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
    } catch {
      // The chat will simply ask.
    }
    trackMeta('Lead', { content_name: 'Text sign-up' });
    trackGa('generate_lead', { lead_source: 'text_signup' });
    setDone(guest);
  }

  if (done) {
    return (
      <div className="signup-done" role="status">
        <h2>Thanks, {firstName(done.name)}.</h2>
        <p>We have your details and will be in touch about your stay.</p>
        <Link href="/search" className="btn btn-solid">
          Browse our homes
        </Link>
      </div>
    );
  }
  return <LeadForm initial={null} onDone={onDone} idPrefix="signup" submitLabel="Sign up" />;
}
