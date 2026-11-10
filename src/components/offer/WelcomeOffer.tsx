'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { SITE } from '@/data/site';
import { trackMeta } from '@/lib/meta-pixel';
import { savePromo } from '@/lib/offer/promo';

/**
 * "X% off your first stay" popup that collects emails for the list.
 *
 * Shown once a visitor has spent a little time on the site (12 s, half a
 * page scrolled, or the mouse heading for the tab bar), never over the chat
 * or the booking sheet, and not again for 14 days after "No thanks" or ever
 * after signing up. On phones it is a small card at the bottom that leaves
 * the page usable, as Google asks of mobile pop-ups.
 *
 * Signing up returns the code (/api/subscribe), which is saved for the
 * booking card to apply automatically.
 */

const SEEN_KEY = 'wk-offer-v1';
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const DELAY_MS = 12_000;
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

function remember(value: Seen) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(value));
  } catch {
    // Not remembered; it simply may show again.
  }
}

export function WelcomeOffer({ percent }: { percent: number }) {
  const [phase, setPhase] = useState<'hidden' | 'form' | 'done'>('hidden');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ code: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const onStayPage = usePathname().startsWith('/stays/');

  useEffect(() => {
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
      setPhase('form');
    };
    function onScroll() {
      const h = document.documentElement;
      if (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight) > 0.45) show();
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
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { code?: string; emailed?: boolean; error?: string };
      if (!res.ok || !body.code) {
        setError(body.error || 'Something went wrong. Please try again.');
        return;
      }
      remember({ state: 'joined' });
      savePromo(body.code);
      // Lets an open booking card re-price with the code right away.
      window.dispatchEvent(new Event('wk-promo'));
      trackMeta('Lead', { content_name: 'Welcome offer' });
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

  if (phase === 'hidden') return null;

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
                Join our list for {percent}% off the nightly rate of your first booking made directly on our site, plus first word on open dates and
                seasonal offers.
              </p>
              <form className="offer-form" onSubmit={submit}>
                <label className="sr-only" htmlFor={`${titleId}-email`}>
                  Email
                </label>
                <input
                  ref={inputRef}
                  id={`${titleId}-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="Your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button type="submit" className="btn btn-solid" disabled={sending}>
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
                By signing up you agree to get emails from {SITE.brand}; unsubscribe anytime. For stays booked directly on {SITE.domain}.
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
                It’s saved on this device and applied automatically when you check prices.
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
