'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Property } from '@/data/types';
import type { Quote } from '@/lib/booking/types';
import { formatShortDate, nightsBetween } from '@/lib/dates';
import { money, plural } from '@/lib/format';
import { parseSearchState } from '@/lib/search-params';
import { DateRangePicker } from './DateRangePicker';

type QuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; quote: Quote }
  | { status: 'error'; message: string };

/** Only Hospitable's hosted checkout is ever a redirect target. */
const isCheckoutUrl = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'booking.hospitable.com';
  } catch {
    return false;
  }
};

/**
 * Our booking card (bookingMode "native"):
 *   pick dates + guests → POST /api/quote → show Hospitable's breakdown →
 *   Reserve → redirect to the quote's booking_url, where Hospitable takes payment.
 */
export function NativeBookingCard({ property: p }: { property: Property }) {
  const initial = parseSearchState(useSearchParams());
  const [checkin, setCheckin] = useState(initial.checkin);
  const [checkout, setCheckout] = useState(initial.checkout);
  const [adults, setAdults] = useState(initial.adults && initial.adults <= p.guests ? initial.adults : 0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quote, setQuote] = useState<QuoteState>({ status: 'idle' });
  const [redirecting, setRedirecting] = useState(false);

  const ready = Boolean(checkin && checkout && adults && nightsBetween(checkin, checkout) >= 1);

  // Keep the stay in the URL so it survives refresh and sharing.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries({ checkin, checkout, adults: adults ? String(adults) : '' })) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    const next = q.toString() ? `?${q}` : window.location.pathname;
    window.history.replaceState(null, '', next);
  }, [checkin, checkout, adults]);

  // Price the stay with Hospitable whenever it changes (debounced; stale requests aborted).
  useEffect(() => {
    if (!ready) {
      // Clearing a field clears the old price.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuote({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    setQuote({ status: 'loading' });
    const timer = setTimeout(() => {
      fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: p.slug, checkin, checkout, adults }),
        signal: controller.signal,
      })
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || 'Couldn’t price those dates.');
          setQuote({ status: 'ready', quote: body as Quote });
        })
        .catch((err: Error) => {
          if (err.name !== 'AbortError') setQuote({ status: 'error', message: err.message });
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [ready, p.slug, checkin, checkout, adults]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (quote.status !== 'ready' || !isCheckoutUrl(quote.quote.bookingUrl)) return;
    setRedirecting(true);
    window.location.assign(quote.quote.bookingUrl);
  }

  const q = quote.status === 'ready' ? quote.quote : null;
  const canReserve = Boolean(q) && !redirecting;

  return (
    <form className="bk" onSubmit={onSubmit}>
      <div className="bk-fields">
        <button type="button" className="bk-f-btn" aria-expanded={pickerOpen} onClick={() => setPickerOpen((o) => !o)}>
          <span>Check-in</span>
          <strong className={checkin ? '' : 'empty'}>{checkin ? formatShortDate(checkin) : 'Add date'}</strong>
        </button>
        <button type="button" className="bk-f-btn" aria-expanded={pickerOpen} onClick={() => setPickerOpen((o) => !o)}>
          <span>Check-out</span>
          <strong className={checkout ? '' : 'empty'}>{checkout ? formatShortDate(checkout) : 'Add date'}</strong>
        </button>
        <label className="bk-f bk-wide">
          <span>Guests</span>
          <select value={adults || ''} onChange={(e) => setAdults(Number(e.target.value) || 0)}>
            <option value="">Add guests</option>
            {Array.from({ length: p.guests }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {plural(n, 'guest')}
              </option>
            ))}
          </select>
        </label>
      </div>

      {pickerOpen ? (
        <DateRangePicker
          slug={p.slug}
          checkin={checkin}
          checkout={checkout}
          onChange={(ci, co) => {
            setCheckin(ci);
            setCheckout(co);
          }}
          onDone={() => setPickerOpen(false)}
        />
      ) : null}

      <div aria-live="polite">
        {quote.status === 'loading' ? <p className="bk-loading">Checking price with live availability…</p> : null}
        {quote.status === 'error' ? <p className="bk-error">{quote.message}</p> : null}
        {q ? (
          <div className="bk-quote">
            <div className="bk-row">
              <span>
                {money(Math.round(q.accommodation / q.nights), q.currency)} avg × {plural(q.nights, 'night')}
              </span>
              <span>{money(q.accommodation, q.currency)}</span>
            </div>
            {q.fees.map((f) => (
              <div className="bk-row" key={f.label}>
                <span>{f.label}</span>
                <span>{money(f.amount, q.currency)}</span>
              </div>
            ))}
            {q.discounts.map((d) => (
              <div className="bk-row discount" key={d.label}>
                <span>{d.label}</span>
                <span>−{money(Math.abs(d.amount), q.currency)}</span>
              </div>
            ))}
            {q.taxes.map((t) => (
              <div className="bk-row muted" key={t.label}>
                <span>{t.label}</span>
                <span>{money(t.amount, q.currency)}</span>
              </div>
            ))}
            <div className="bk-row bk-total">
              <span>Total</span>
              <span>{money(q.total, q.currency)}</span>
            </div>
            {!q.fees.some((f) => /service/i.test(f.label)) ? <div className="bk-save">No service fee when you book direct</div> : null}
          </div>
        ) : null}
      </div>

      <button className="btn btn-solid bk-go" type="submit" disabled={!canReserve}>
        {redirecting ? 'Opening secure checkout…' : q ? 'Reserve' : 'Check availability'}
      </button>
      <p className="booking-foot">You won&apos;t be charged yet. Secure payment on the next step.</p>
    </form>
  );
}
