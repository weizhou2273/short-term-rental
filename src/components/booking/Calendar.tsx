'use client';

import { useMemo, useState } from 'react';
import type { AvailabilityNight } from '@/lib/booking/types';
import {
  addDays,
  addMonths,
  dayOfWeek,
  formatMonthLabel,
  nightsBetween,
  startOfMonth,
  today,
  type IsoDate,
} from '@/lib/util/date';
import { formatMoneyCompact } from '@/lib/util/money';
import { cn } from '@/lib/util/cn';

export type StaySelection = { arrival: IsoDate | null; departure: IsoDate | null };

type CalendarProps = {
  nights: AvailabilityNight[];
  value: StaySelection;
  onChange: (value: StaySelection) => void;
  minNights: number;
  /** Render two months side by side on wide screens. */
  months?: number;
  showRates?: boolean;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type DayCell = { date: IsoDate; night: AvailabilityNight | undefined } | null;

function buildMonth(monthStart: IsoDate, byDate: Map<IsoDate, AvailabilityNight>): DayCell[] {
  const leading = dayOfWeek(monthStart);
  const cells: DayCell[] = Array.from({ length: leading }, () => null);
  const monthPrefix = monthStart.slice(0, 7);

  for (let day = 0; ; day += 1) {
    const date = addDays(monthStart, day);
    if (!date.startsWith(monthPrefix)) break;
    cells.push({ date, night: byDate.get(date) });
  }
  return cells;
}

export function Calendar({
  nights,
  value,
  onChange,
  minNights,
  months = 2,
  showRates = true,
}: CalendarProps) {
  const byDate = useMemo(
    () => new Map(nights.map((night) => [night.date, night])),
    [nights],
  );

  const [cursor, setCursor] = useState<IsoDate>(() =>
    startOfMonth(value.arrival ?? today()),
  );
  const [hovered, setHovered] = useState<IsoDate | null>(null);

  const now = today();
  const lastMonth = startOfMonth(nights.at(-1)?.date ?? addMonths(now, 12));
  const canGoBack = cursor > startOfMonth(now);
  const canGoForward = addMonths(cursor, months - 1) < lastMonth;

  const visibleMonths = useMemo(
    () => Array.from({ length: months }, (_, index) => addMonths(cursor, index)),
    [cursor, months],
  );

  /**
   * Picking dates is a two-step interaction: the first click sets arrival, the
   * second sets departure. Clicking a date before the current arrival restarts
   * the selection rather than producing an inverted range.
   */
  function handleSelect(date: IsoDate) {
    const { arrival, departure } = value;
    if (!arrival || departure || date <= arrival) {
      onChange({ arrival: date, departure: null });
      return;
    }
    onChange({ arrival, departure: date });
  }

  /**
   * Which dates a click is allowed to land on.
   *
   * Once an arrival is chosen, the only valid next click is a departure that
   * is far enough out and does not jump over a booked night — otherwise a
   * guest can select a range straddling someone else's stay.
   */
  function isSelectable(date: IsoDate, night: AvailabilityNight | undefined): boolean {
    if (date < now) return false;
    if (!night) return false;

    const { arrival, departure } = value;
    const choosingArrival = !arrival || Boolean(departure) || date <= arrival;

    if (choosingArrival) return night.status === 'available' && night.canCheckIn;

    if (nightsBetween(arrival, date) < minNights) return false;
    if (!night.canCheckOut) return false;

    // Every night actually slept in must be free.
    for (let cursorDate = arrival; cursorDate < date; cursorDate = addDays(cursorDate, 1)) {
      const row = byDate.get(cursorDate);
      if (!row || row.status !== 'available') return false;
    }
    return true;
  }

  const rangeEnd = value.departure ?? (value.arrival && hovered && hovered > value.arrival ? hovered : null);

  function inRange(date: IsoDate): boolean {
    if (!value.arrival || !rangeEnd) return false;
    return date > value.arrival && date < rangeEnd;
  }

  return (
    <div className="select-none">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor(addMonths(cursor, -1))}
          disabled={!canGoBack}
          aria-label="Previous month"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line-strong)] text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:opacity-30 disabled:hover:border-[var(--color-line-strong)]"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 2 4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p aria-live="polite" className="text-sm font-medium text-[var(--color-ink)]">
          {visibleMonths.map((month) => formatMonthLabel(month)).join(' — ')}
        </p>
        <button
          type="button"
          onClick={() => setCursor(addMonths(cursor, 1))}
          disabled={!canGoForward}
          aria-label="Next month"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line-strong)] text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:opacity-30 disabled:hover:border-[var(--color-line-strong)]"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="m5 2 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div
        className={cn('grid gap-8', months > 1 && 'sm:grid-cols-2')}
        onMouseLeave={() => setHovered(null)}
      >
        {visibleMonths.map((monthStart, monthIndex) => (
          <div key={monthStart} className={cn(monthIndex > 0 && months > 1 && 'hidden sm:block')}>
            <p className="mb-3 text-center text-[0.8125rem] font-medium text-[var(--color-ink-muted)] sm:text-left">
              {formatMonthLabel(monthStart)}
            </p>
            <div className="grid grid-cols-7 gap-px" role="grid" aria-label={formatMonthLabel(monthStart)}>
              {WEEKDAYS.map((label, index) => (
                <div
                  key={`${monthStart}-head-${index}`}
                  className="pb-2 text-center text-[0.625rem] font-medium tracking-wider text-[var(--color-ink-faint)]"
                  aria-hidden="true"
                >
                  {label}
                </div>
              ))}

              {buildMonth(monthStart, byDate).map((cell, index) => {
                if (!cell) return <div key={`${monthStart}-pad-${index}`} aria-hidden="true" />;

                const { date, night } = cell;
                const selectable = isSelectable(date, night);
                const isArrival = value.arrival === date;
                const isDeparture = value.departure === date;
                const between = inRange(date);
                const unavailable = !night || night.status !== 'available' || date < now;

                return (
                  <button
                    key={date}
                    type="button"
                    role="gridcell"
                    disabled={!selectable}
                    onClick={() => handleSelect(date)}
                    onMouseEnter={() => setHovered(date)}
                    onFocus={() => setHovered(date)}
                    aria-label={`${date}${unavailable ? ', unavailable' : ''}`}
                    aria-selected={isArrival || isDeparture}
                    className={cn(
                      'relative flex aspect-square flex-col items-center justify-center rounded-[var(--radius-sm)] text-[0.8125rem] transition-colors duration-150',
                      unavailable && 'cursor-not-allowed text-[var(--color-ink-faint)] line-through decoration-[var(--color-line-strong)]',
                      !unavailable && !selectable && 'cursor-not-allowed text-[var(--color-ink-faint)]',
                      selectable && 'cursor-pointer text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)]',
                      between && 'bg-[var(--color-accent-soft)]',
                      (isArrival || isDeparture) &&
                        'bg-[var(--color-ink)] text-[var(--color-canvas)] hover:bg-[var(--color-ink)]',
                    )}
                  >
                    <span className="tabular leading-none">{Number(date.slice(8, 10))}</span>
                    {showRates && night?.rate && !unavailable ? (
                      <span
                        className={cn(
                          'mt-0.5 hidden text-[0.5625rem] leading-none tabular sm:block',
                          isArrival || isDeparture
                            ? 'text-[var(--color-canvas)]/70'
                            : 'text-[var(--color-ink-faint)]',
                        )}
                      >
                        {formatMoneyCompact(night.rate).replace(/\.00$/, '')}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs text-[var(--color-ink-faint)]">
        {value.arrival && !value.departure
          ? `Now choose a departure date — ${minNights} night${minNights === 1 ? '' : 's'} minimum.`
          : `Rates shown are per night. ${minNights}-night minimum.`}
      </p>
    </div>
  );
}
