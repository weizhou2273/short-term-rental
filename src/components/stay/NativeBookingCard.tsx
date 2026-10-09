'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Property } from '@/data/types';
import type { Quote } from '@/lib/booking/types';
import { MAX_INFANTS, MAX_PETS, validateGuestDetails, type GuestDetails } from '@/lib/booking/guest';
import { formatShortDate, nightsBetween } from '@/lib/dates';
import { money, plural, wholeDollars } from '@/lib/format';
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

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

/** Reads a whole-number count from the URL, clamped to [0, max]. */
function countParam(params: URLSearchParams, key: string, max: number): number {
  const n = Number.parseInt(params.get(key) ?? '', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
}

async function postQuote(payload: object, signal?: AbortSignal): Promise<Quote> {
  const res = await fetch('/api/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Couldn’t price those dates.');
  return body as Quote;
}

const EMPTY_DETAILS: GuestDetails = { firstName: '', lastName: '', email: '', phone: '' };

/**
 * Contact details are kept for this browser tab only (sessionStorage), so a
 * guest who goes back from Hospitable's checkout to change dates doesn't have
 * to retype them. They're gone when the tab closes — safe on a shared
 * computer — and never put in the URL. Returning guests on their own device
 * get the browser's autofill instead (see the autoComplete attributes).
 */
const DETAILS_KEY = 'wk-guest-details';

function loadDetails(): GuestDetails {
  try {
    const saved: unknown = JSON.parse(window.sessionStorage.getItem(DETAILS_KEY) ?? 'null');
    if (!saved || typeof saved !== 'object') return EMPTY_DETAILS;
    const get = (k: keyof GuestDetails) => {
      const v = (saved as Record<string, unknown>)[k];
      return typeof v === 'string' ? v : '';
    };
    return { firstName: get('firstName'), lastName: get('lastName'), email: get('email'), phone: get('phone') };
  } catch {
    // Storage blocked (private mode, settings): start empty.
    return EMPTY_DETAILS;
  }
}

function saveDetails(details: GuestDetails) {
  try {
    if (Object.values(details).some(Boolean)) window.sessionStorage.setItem(DETAILS_KEY, JSON.stringify(details));
    else window.sessionStorage.removeItem(DETAILS_KEY);
  } catch {
    // Storage blocked: the form still works, it just won't remember.
  }
}

/**
 * Our booking card (bookingMode "native"):
 *   pick dates + guests → POST /api/quote → show Hospitable's breakdown →
 *   add contact details → Reserve → POST /api/quote again with guest details →
 *   redirect to that quote's booking_url, where Hospitable's checkout opens
 *   pre-filled and takes payment.
 */
export function NativeBookingCard({ property: p, onQuote }: { property: Property; onQuote?: (quote: Quote | null) => void }) {
  const searchParams = useSearchParams();
  const initial = parseSearchState(searchParams);
  const [checkin, setCheckin] = useState(initial.checkin);
  const [checkout, setCheckout] = useState(initial.checkout);
  // One adult until the guest says otherwise, as on Airbnb, so dates alone get a price.
  const [adults, setAdults] = useState(initial.adults && initial.adults <= p.guests ? initial.adults : 1);
  const [children, setChildren] = useState(() => countParam(searchParams, 'children', p.guests - 1));
  const [infants, setInfants] = useState(() => countParam(searchParams, 'infants', MAX_INFANTS));
  const [pets, setPets] = useState(() => (p.features.petFriendly ? countParam(searchParams, 'pets', MAX_PETS) : 0));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quote, setQuote] = useState<QuoteState>({ status: 'idle' });
  // Bumped by "Try again" to re-run the price check for the same stay.
  const [attempt, setAttempt] = useState(0);
  // Shown when "Check availability" is pressed with something still missing.
  const [nudge, setNudge] = useState<string | null>(null);
  const adultsRef = useRef<HTMLSelectElement>(null);

  // This card renders only in the browser (useSearchParams under Suspense), so
  // reading sessionStorage while initialising state is safe.
  const [details, setDetails] = useState<GuestDetails>(loadDetails);
  const [touched, setTouched] = useState<Partial<Record<keyof GuestDetails, boolean>>>({});
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [priceChanged, setPriceChanged] = useState(false);

  const ready = Boolean(checkin && checkout && adults && nightsBetween(checkin, checkout) >= 1);
  const stay = { slug: p.slug, checkin, checkout, adults, children, infants, pets };

  // Remember what the guest typed for this tab (see DETAILS_KEY).
  useEffect(() => {
    saveDetails(details);
  }, [details]);

  // Keep the stay (not the guest's details) in the URL so it survives refresh and sharing.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const values = {
      checkin,
      checkout,
      adults: adults ? String(adults) : '',
      children: children ? String(children) : '',
      infants: infants ? String(infants) : '',
      pets: pets ? String(pets) : '',
    };
    for (const [k, v] of Object.entries(values)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    const next = q.toString() ? `?${q}` : window.location.pathname;
    window.history.replaceState(null, '', next);
  }, [checkin, checkout, adults, children, infants, pets]);

  // Price the stay with Hospitable whenever it changes (debounced; stale requests aborted).
  useEffect(() => {
    // A new stay supersedes the old price and any Reserve feedback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPriceChanged(false);
    setReserveError(null);
    setNudge(null);
    if (!ready) {
      setQuote({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    setQuote({ status: 'loading' });
    const timer = setTimeout(() => {
      postQuote({ slug: p.slug, checkin, checkout, adults, children, infants, pets }, controller.signal)
        .then((q) => setQuote({ status: 'ready', quote: q }))
        .catch((err: Error) => {
          if (err.name !== 'AbortError') setQuote({ status: 'error', message: err.message });
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [ready, p.slug, checkin, checkout, adults, children, infants, pets, attempt]);

  const q = quote.status === 'ready' ? quote.quote : null;

  useEffect(() => {
    onQuote?.(q);
  }, [q, onQuote]);
  const errors = validateGuestDetails(details);
  const detailsValid = Object.keys(errors).length === 0;
  const busy = quote.status === 'loading' || reserving;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!q) {
      // The price is fetched automatically; the button just says what's still needed.
      if (!checkin || !checkout) {
        setPickerOpen(true);
        setNudge('Choose your check-in and check-out dates.');
      } else if (!adults) {
        adultsRef.current?.focus();
        setNudge('Add the number of adults.');
      } else if (quote.status === 'error') {
        setAttempt((n) => n + 1);
      }
      return;
    }
    if (!detailsValid) {
      setTouched({ firstName: true, lastName: true, email: true, phone: true });
      const firstInvalid = (['firstName', 'lastName', 'email', 'phone'] as const).find((k) => errors[k]);
      const input = firstInvalid ? e.currentTarget.elements.namedItem(firstInvalid) : null;
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    setReserving(true);
    setReserveError(null);
    setPriceChanged(false);
    try {
      // A fresh quote carrying the guest's details, so checkout opens pre-filled
      // and availability is checked one last time.
      const final = await postQuote({ ...stay, guest: details });
      if (!isCheckoutUrl(final.bookingUrl)) throw new Error('Couldn’t start checkout. Please try again.');
      if (final.total !== q.total) {
        setQuote({ status: 'ready', quote: final });
        setPriceChanged(true);
        setReserving(false);
        return;
      }
      window.location.assign(final.bookingUrl);
    } catch (err) {
      setReserveError((err as Error).message);
      setReserving(false);
    }
  }

  const field = (key: keyof GuestDetails) => ({
    value: details[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDetails((d) => ({ ...d, [key]: e.target.value })),
    onBlur: () => setTouched((t) => ({ ...t, [key]: true })),
    'aria-invalid': Boolean(touched[key] && errors[key]),
    'aria-describedby': touched[key] && errors[key] ? `bk-err-${key}` : undefined,
  });
  const fieldError = (key: keyof GuestDetails) =>
    touched[key] && errors[key] ? (
      <small className="bk-err" id={`bk-err-${key}`}>
        {errors[key]}
      </small>
    ) : null;

  return (
    <form className="bk" onSubmit={onSubmit} noValidate>
      {/* No "from" price: like Airbnb, the heading is the chosen stay's total with all fees, before taxes. */}
      <div className="booking-price">
        {q ? (
          <>
            <strong>{wholeDollars(q.totalBeforeTaxes, q.currency)}</strong> for {plural(q.nights, 'night')}
          </>
        ) : checkin && checkout ? (
          'Your stay'
        ) : (
          'Add dates for prices'
        )}
      </div>
      <div className="bk-fields">
        <button type="button" className="bk-f-btn" aria-expanded={pickerOpen} onClick={() => setPickerOpen((o) => !o)}>
          <span>Check-in</span>
          <strong className={checkin ? '' : 'placeholder'}>{checkin ? formatShortDate(checkin) : 'Add date'}</strong>
        </button>
        <button type="button" className="bk-f-btn" aria-expanded={pickerOpen} onClick={() => setPickerOpen((o) => !o)}>
          <span>Check-out</span>
          <strong className={checkout ? '' : 'placeholder'}>{checkout ? formatShortDate(checkout) : 'Add date'}</strong>
        </button>
        <label className="bk-f">
          <span>Adults</span>
          <select ref={adultsRef} value={adults || ''} onChange={(e) => setAdults(Number(e.target.value) || 0)}>
            <option value="">Add adults</option>
            {range(1, p.guests - children).map((n) => (
              <option key={n} value={n}>
                {plural(n, 'adult')}
              </option>
            ))}
          </select>
        </label>
        <label className="bk-f">
          <span>Children</span>
          <select value={children} onChange={(e) => setChildren(Number(e.target.value))}>
            {range(0, p.guests - Math.max(adults, 1)).map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'None' : n === 1 ? '1 child' : `${n} children`}
              </option>
            ))}
          </select>
        </label>
        <label className={`bk-f${p.features.petFriendly ? '' : ' bk-wide'}`}>
          <span>Infants</span>
          <select value={infants} onChange={(e) => setInfants(Number(e.target.value))}>
            {range(0, MAX_INFANTS).map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'None' : plural(n, 'infant')}
              </option>
            ))}
          </select>
        </label>
        {p.features.petFriendly ? (
          <label className="bk-f">
            <span>Pets</span>
            <select value={pets} onChange={(e) => setPets(Number(e.target.value))}>
              {range(0, MAX_PETS).map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'None' : plural(n, 'pet')}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <p className="bk-hint">
        {p.guests} guests max, not counting infants{p.features.petFriendly ? '' : ' · No pets'}
      </p>

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
        {/* The button shows the loading state; this tells screen readers. */}
        {quote.status === 'loading' ? <p className="sr-only">Checking availability and price…</p> : null}
        {nudge ? <p className="bk-notice">{nudge}</p> : null}
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
        {priceChanged && q ? (
          <p className="bk-notice">The price was just updated to {money(q.total, q.currency)}. Review it and press Reserve again.</p>
        ) : null}
        {reserveError ? <p className="bk-error">{reserveError}</p> : null}
      </div>

      {q ? (
        <fieldset className="bk-details">
          <legend>Your details</legend>
          <div className="bk-fields">
            <label className="bk-f">
              <span>First name</span>
              <input type="text" name="firstName" autoComplete="given-name" maxLength={80} {...field('firstName')} />
              {fieldError('firstName')}
            </label>
            <label className="bk-f">
              <span>Last name</span>
              <input type="text" name="lastName" autoComplete="family-name" maxLength={80} {...field('lastName')} />
              {fieldError('lastName')}
            </label>
            <label className="bk-f bk-wide">
              <span>Email</span>
              <input type="email" name="email" autoComplete="email" inputMode="email" maxLength={254} {...field('email')} />
              {fieldError('email')}
            </label>
            <label className="bk-f bk-wide">
              <span>Phone</span>
              <input type="tel" name="phone" autoComplete="tel" inputMode="tel" maxLength={32} placeholder="(570) 555-0123" {...field('phone')} />
              {fieldError('phone')}
            </label>
          </div>
          <p className="bk-hint">Used to pre-fill secure checkout and to send your booking details.</p>
        </fieldset>
      ) : null}

      {/* Never disabled: it opens what's missing, retries, or shows a spinner while busy. */}
      <button className={`btn btn-solid bk-go${busy ? ' is-busy' : ''}`} type="submit" aria-disabled={busy || undefined}>
        {busy ? <span className="spinner" aria-hidden="true" /> : null}
        {reserving
          ? 'Opening secure checkout…'
          : quote.status === 'loading'
            ? 'Checking availability…'
            : q
              ? 'Reserve'
              : quote.status === 'error'
                ? 'Try again'
                : 'Check availability'}
      </button>
      {q && !detailsValid ? <p className="booking-foot">Add your name, email and phone to reserve.</p> : null}
      <p className="booking-foot">You won&apos;t be charged yet. Secure payment on the next step.</p>
    </form>
  );
}
