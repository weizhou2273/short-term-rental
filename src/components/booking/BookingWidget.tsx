'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { AvailabilityNight, GuestCount, Property } from '@/lib/booking/types';
import { defaultGuestCount } from '@/lib/booking/validation';
import { useQuote } from '@/hooks/useQuote';
import { formatShortDate, isIsoDate, nightsBetween, type IsoDate } from '@/lib/util/date';
import { formatMoneyCompact } from '@/lib/util/money';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Calendar, type StaySelection } from './Calendar';
import { GuestPicker } from './GuestPicker';
import { QuoteSummary } from './QuoteSummary';
import { cn } from '@/lib/util/cn';

/**
 * The booking panel on a property page.
 *
 * It prices continuously as the guest changes dates, but it never creates a
 * reservation — pressing "Reserve" hands off to `/book/[slug]`, which re-quotes
 * server-side before it asks for money. Nothing here is trusted downstream.
 */
export function BookingWidget({
  property,
  nights,
}: {
  property: Property;
  nights: AvailabilityNight[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  /**
   * Dates and party size can arrive from a shared link or a search. Reading
   * them here rather than on the server keeps the property page statically
   * rendered — it is the site's main SEO and LCP surface, and prerendering it
   * matters more than server-rendering a prefilled form.
   *
   * Anything malformed is ignored rather than trusted; the server validates
   * again before it prices or books anything.
   */
  const [selection, setSelection] = useState<StaySelection>(() => {
    const arrival = params.get('arrival');
    const departure = params.get('departure');
    return {
      arrival: arrival && isIsoDate(arrival) ? arrival : null,
      departure: departure && isIsoDate(departure) ? departure : null,
    };
  });

  const [guests, setGuests] = useState<GuestCount>(() => {
    const read = (key: keyof GuestCount, fallback: number) => {
      const parsed = Number.parseInt(params.get(key) ?? '', 10);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    };
    return {
      adults: Math.max(1, read('adults', defaultGuestCount.adults)),
      children: read('children', 0),
      infants: read('infants', 0),
      pets: property.rules.petsAllowed ? read('pets', 0) : 0,
    };
  });

  const [calendarOpen, setCalendarOpen] = useState(false);

  const { quote, loading, error, issues } = useQuote({
    propertyId: property.id,
    arrival: selection.arrival,
    departure: selection.departure,
    guests,
  });

  const stayNights =
    selection.arrival && selection.departure
      ? nightsBetween(selection.arrival, selection.departure)
      : 0;

  const fromRate = useMemo(() => {
    const rates = nights
      .filter((night) => night.status === 'available' && night.rate)
      .map((night) => night.rate!.amount);
    if (rates.length === 0) return property.baseNightlyRate;
    return { amount: Math.min(...rates), currency: property.currency };
  }, [nights, property.baseNightlyRate, property.currency]);

  function reserve() {
    if (!selection.arrival || !selection.departure) {
      setCalendarOpen(true);
      return;
    }
    const params = new URLSearchParams({
      arrival: selection.arrival,
      departure: selection.departure,
      adults: String(guests.adults),
      children: String(guests.children),
      infants: String(guests.infants),
      pets: String(guests.pets),
    });
    router.push(`/book/${property.slug}?${params.toString()}`);
  }

  const blocking = issues.length > 0;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lift)]">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[var(--color-ink)]">
          {fromRate ? (
            <>
              <span className="text-2xl font-medium tabular">{formatMoneyCompact(fromRate)}</span>
              <span className="ml-1.5 text-sm text-[var(--color-ink-muted)]">per night</span>
            </>
          ) : (
            <span className="text-lg">Rates on request</span>
          )}
        </p>
        <p className="text-xs text-[var(--color-ink-faint)]">
          {property.rules.minNights}-night min
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line-strong)]">
        <DateButton
          label="Check in"
          value={selection.arrival}
          onClick={() => setCalendarOpen(true)}
          active={calendarOpen && !selection.arrival}
        />
        <DateButton
          label="Check out"
          value={selection.departure}
          onClick={() => setCalendarOpen(true)}
          active={calendarOpen && Boolean(selection.arrival) && !selection.departure}
          className="border-l border-[var(--color-line-strong)]"
        />
      </div>

      <div className="mt-3">
        <GuestPicker property={property} value={guests} onChange={setGuests} />
      </div>

      {calendarOpen ? (
        <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
          <Calendar
            nights={nights}
            value={selection}
            onChange={(next) => {
              setSelection(next);
              if (next.arrival && next.departure) setCalendarOpen(false);
            }}
            minNights={property.rules.minNights}
            months={1}
          />
          <div className="mt-3 flex justify-between">
            <button
              type="button"
              onClick={() => setSelection({ arrival: null, departure: null })}
              className="text-xs text-[var(--color-ink-muted)] underline underline-offset-4 hover:text-[var(--color-ink)]"
            >
              Clear dates
            </button>
            <button
              type="button"
              onClick={() => setCalendarOpen(false)}
              className="text-xs text-[var(--color-ink-muted)] underline underline-offset-4 hover:text-[var(--color-ink)]"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {issues.length > 0 ? (
        <Alert tone="warning" className="mt-5">
          <ul className="space-y-1">
            {issues.map((issue) => (
              <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {error && issues.length === 0 ? (
        <Alert tone="critical" className="mt-5">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <div className="mt-6 space-y-2" aria-live="polite" aria-busy="true">
          <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--color-canvas-sunk)]" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--color-canvas-sunk)]" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--color-canvas-sunk)]" />
        </div>
      ) : null}

      {quote && !loading ? <QuoteSummary quote={quote} className="mt-6" /> : null}

      <Button
        size="lg"
        className="mt-6 w-full"
        onClick={reserve}
        disabled={blocking || (stayNights > 0 && loading)}
      >
        {stayNights > 0 ? `Reserve ${stayNights} night${stayNights === 1 ? '' : 's'}` : 'Choose dates'}
      </Button>

      <p className="mt-3 text-center text-xs text-[var(--color-ink-faint)]">
        No booking fees. You are not charged until the next step.
      </p>
    </div>
  );
}

function DateButton({
  label,
  value,
  onClick,
  active,
  className,
}: {
  label: string;
  value: IsoDate | null;
  onClick: () => void;
  active: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start bg-[var(--color-surface)] px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--color-canvas-sunk)]',
        active && 'bg-[var(--color-accent-soft)]',
        className,
      )}
    >
      <span className="text-[0.625rem] font-medium uppercase tracking-wider text-[var(--color-ink-faint)]">
        {label}
      </span>
      <span className="mt-0.5 text-sm text-[var(--color-ink)]">
        {value ? formatShortDate(value) : 'Add date'}
      </span>
    </button>
  );
}
