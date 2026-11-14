'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { SmsConsentBoxes } from '@/components/legal/SmsConsent';
import { SITE } from '@/data/site';
import { GUEST_KEY, isPhone, LEAD_LIMITS, NAME_PATTERN, NO_SMS_CONSENT } from '@/lib/chat/shared';
import { trackGa } from '@/lib/google-analytics';
import { trackMeta } from '@/lib/meta-pixel';
import { savePromo } from '@/lib/offer/promo';

/**
 * "X% off your first stay" popup that collects a name, email and phone
 * number for the list (and for the host to follow up), with the two
 * optional text-message boxes under the fields.
 *
 * Shown once a visitor has had a moment on the site (4 s, a quarter of a
 * page scrolled, or the mouse heading for the tab bar), never over the chat
 * or the booking sheet, and not again for 14 days after "No thanks" or ever
 * after signing up. On phones it is a small card at the bottom that leaves
 * the page usable, as Google asks of mobile pop-ups. Add ?offer to any URL
 * to open it at once (a preview; nothing appears if the offer is off).
 *
 * Signing up returns the code (/api/subscribe), which is saved for the
 * booking card to apply automatically. The form starts with whatever the
 * guest already told the chat, and the chat starts with what they enter
 * here, so nobody types their details twice.
 */

const SEEN_KEY = 'wk-offer-v1';
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const DELAY_MS = 4_000;
/** Share of the page scrolled that also opens it. */
const SCROLL_SHARE = 0.25;
/** Don't open over these; try again later instead. */
const BUSY = '.chat-panel:not([hidden]), .booking-col.open, .modal:not([hidden])';

type Seen = { state: 'joined' } | { state: 'dismissed'; at: number };

function seen(): Seen | null {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null') as Seen | null;
  } catch {
    // Storage blocked: say "seen" so a visitor who can't dismiss it for good isn't asked on every page.
    return { state: 'dismissed', at: Date.now() };
  }
}

type Details = { name: string; email: string; phone: string };

/** What the guest already gave the chat (or this form), if anything. */
function savedDetails(): Details {
  try {
    const g = JSON.parse(localStorage.getItem(GUEST_KEY) ?? 'null') as Partial<Details> | null;
    return { name: g?.name ?? '', email: g?.email ?? '', phone: g?.phone ?? '' };
  } catch {
    return { name: '', email: '', phone: '' };
  }
}

/** Keeps the details for the chat's sign-in, unless the chat already has its own (with its token). */
function shareWithChat(details: Details) {
  try {
    if (!localStorage.getItem(GUEST_KEY)) localStorage.setItem(GUEST_KEY, JSON.stringify({ ...details, token: null }));
  } catch {
    // The chat will simply ask.
  }
}

function remember(value: Seen) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(value));
  } catch {
    // Not remembered; it simply may show again.
  }
}

export function WelcomeOffer({ percent, minNights }: { percent: number; minNights: number }) {
  const ofMin = minNights > 1 ? ` of ${minNights} nights or more` : '';
  const [phase, setPhase] = useState<'hidden' | 'form' | 'done'>('hidden');
  const [details, setDetails] = useState<Details>({ name: '', email: '', phone: '' });
  // The text-message boxes always start unticked.
  const [consent, setConsent] = useState(NO_SMS_CONSENT);
  const set = (field: keyof Details) => (e: { target: { value: string } }) => setDetails((d) => ({ ...d, [field]: e.target.value }));
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ code: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  const onStayPage = pathname.startsWith('/stays/');

  useEffect(() => {
    // ?offer opens it straight away, even after signing up or "No thanks": for the owner to preview it.
    if (new URLSearchParams(window.location.search).has('offer')) {
      const timer = setTimeout(() => {
        returnTo.current = document.activeElement as HTMLElement | null;
        setDetails(savedDetails());
        setPhase('form');
      }, 300);
      return () => clearTimeout(timer);
    }
    const prior = seen();
    if (prior?.state === 'joined' || (prior?.state === 'dismissed' && Date.now() - prior.at < SNOOZE_MS)) return;

    let timer: ReturnType<typeof setTimeout>;
    const stop = () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
    const show = () => {
      if (document.querySelector(BUSY)) {
        clearTimeout(timer);
        timer = setTimeout(show, 15_000);
        return;
      }
      stop();
      returnTo.current = document.activeElement as HTMLElement | null;
      setDetails(savedDetails());
      setPhase('form');
    };
    function onScroll() {
      const h = document.documentElement;
      if (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight) > SCROLL_SHARE) show();
    }
    function onLeave(e: MouseEvent) {
      if (!e.relatedTarget && e.clientY <= 0) show();
    }
    timer = setTimeout(show, DELAY_MS);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    return stop;
  }, []);

  useEffect(() => {
    if (phase === 'form') inputRef.current?.focus({ preventScroll: true });
  }, [phase]);

  function close() {
    if (phase === 'form') remember({ state: 'dismissed', at: Date.now() });
    setPhase('hidden');
    returnTo.current?.focus?.({ preventScroll: true });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    const lead = { name: details.name.trim(), email: details.email.trim(), phone: details.phone.trim() };
    if (!NAME_PATTERN.test(lead.name)) return setError('Please enter your name using letters only.');
    if (!isPhone(lead.phone)) return setError('Please enter a phone number we can call or text, with area code.');
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lead, ...consent }),
      });
      const body = (await res.json().catch(() => ({}))) as { code?: string; emailed?: boolean; error?: string };
      if (!res.ok || !body.code) {
        setError(body.error || 'Something went wrong. Please try again.');
        return;
      }
      remember({ state: 'joined' });
      shareWithChat(lead);
      savePromo(body.code);
      // Lets an open booking card re-price with the code right away.
      window.dispatchEvent(new Event('wk-promo'));
      trackMeta('Lead', { content_name: 'Welcome offer' });
      trackGa('generate_lead', { lead_source: 'welcome_offer' });
      setResult({ code: body.code, emailed: Boolean(body.emailed) });
      setPhase('done');
    } catch {
      setError('Couldn’t reach us. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
    } catch {
      // The code is on screen to copy by hand.
    }
  }

  // Escape closes; Tab stays inside the card.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') return close();
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input');
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  // /text-signup is a plain page with one form on it; no pop-up over it.
  if (phase === 'hidden' || pathname === '/text-signup') return null;

  return (
    <div className="offer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div ref={dialogRef} className="offer" role="dialog" aria-labelledby={titleId} onKeyDown={onKeyDown}>
        <div className="offer-art" aria-hidden="true" />
        <div className="offer-body">
          <button type="button" className="offer-close" aria-label="Close" onClick={close}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          {phase === 'form' ? (
            <>
              <span className="eyebrow">Welcome offer</span>
              <h2 id={titleId}>{percent}% off your first stay</h2>
              <p className="offer-text">
                Join our list for {percent}% off the nightly rate of your first direct booking{ofMin}, plus first word on open dates and seasonal
                offers.
              </p>
              <form className="offer-form" onSubmit={submit}>
                <label className="sr-only" htmlFor={`${titleId}-name`}>
                  Name
                </label>
                <input
                  ref={inputRef}
                  id={`${titleId}-name`}
                  autoComplete="name"
                  required
                  maxLength={LEAD_LIMITS.name}
                  placeholder="Name"
                  value={details.name}
                  onChange={set('name')}
                />
                <label className="sr-only" htmlFor={`${titleId}-phone`}>
                  Phone
                </label>
                <input
                  id={`${titleId}-phone`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  maxLength={LEAD_LIMITS.phone}
                  placeholder="Phone"
                  value={details.phone}
                  onChange={set('phone')}
                />
                <label className="sr-only" htmlFor={`${titleId}-email`}>
                  Email
                </label>
                <input
                  id={`${titleId}-email`}
                  className="offer-wide"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  maxLength={LEAD_LIMITS.email}
                  placeholder="Email"
                  value={details.email}
                  onChange={set('email')}
                />
                <SmsConsentBoxes idPrefix="offer" className="offer-wide" value={consent} onChange={setConsent} />
                <button type="submit" className="btn btn-solid offer-wide" disabled={sending}>
                  {sending ? 'One moment…' : `Get my ${percent}% code`}
                </button>
              </form>
              {error ? (
                <p className="offer-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="button" className="btn-link offer-skip" onClick={close}>
                No thanks
              </button>
              <p className="offer-fine">
                We may also email or call you about your stay and our offers; unsubscribe anytime. For stays booked directly on {SITE.domain}.
              </p>
            </>
          ) : result ? (
            <>
              <span className="eyebrow">You’re in</span>
              <h2 id={titleId}>Here’s your {percent}% code</h2>
              <div className="offer-code">
                <strong>{result.code}</strong>
                <button type="button" className="btn-link" onClick={copy}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="offer-text" role="status">
                It’s saved on this device and applied automatically to stays{ofMin} when you check prices.
                {result.emailed ? ' We’ve also emailed it to you.' : ''}
              </p>
              {onStayPage ? (
                <button type="button" className="btn btn-solid offer-cta" onClick={close}>
                  Check prices
                </button>
              ) : (
                <Link href="/search" className="btn btn-solid offer-cta" onClick={close}>
                  Browse homes
                </Link>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
