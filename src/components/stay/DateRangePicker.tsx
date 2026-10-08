'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CalendarDay } from '@/lib/booking/types';
import { canCheckIn, canCheckOut, minStayFor, toDayMap } from '@/lib/booking/availability';
import { addDays, addMonths, endOfMonth, startOfMonth, todayIso } from '@/lib/dates';

type Props = {
  slug: string;
  checkin: string;
  checkout: string;
  onChange: (checkin: string, checkout: string) => void;
  onDone: () => void;
};

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function monthLabel(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function fullLabel(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Month calendar for the booking card. Booked nights come from Hospitable's
 * property calendar (via /api/calendar) and are disabled, as are check-out
 * days that would cross a booked night or break the minimum stay.
 */
export function DateRangePicker({ slug, checkin, checkout, onChange, onDone }: Props) {
  const today = todayIso();
  const [month, setMonth] = useState(startOfMonth(checkin || today));
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const [failed, setFailed] = useState(false);

  // Load the visible month plus the next, so a stay can run across the boundary.
  useEffect(() => {
    const months = [month, addMonths(month, 1)].filter((m) => !loaded.has(m));
    if (!months.length) return;
    const start = months[0]! < today ? today : months[0]!;
    const end = endOfMonth(months[months.length - 1]!);
    if (end < today) return;
    const controller = new AbortController();
    fetch(`/api/calendar?${new URLSearchParams({ slug, start, end })}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { days: CalendarDay[] };
        setDays((prev) => [...prev.filter((d) => d.date < start || d.date > end), ...body.days]);
        setLoaded((prev) => new Set([...prev, ...months]));
        setFailed(false);
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setFailed(true);
      });
    return () => controller.abort();
  }, [month, slug, today, loaded]);

  const map = useMemo(() => toDayMap(days), [days]);
  const choosingCheckout = Boolean(checkin && !checkout);
  const minStay = checkin ? minStayFor(checkin, map) : null;
  const loading = !loaded.has(month) && !failed;

  function isDisabled(date: string) {
    if (choosingCheckout && date > checkin) return !canCheckOut(checkin, date, map);
    return !canCheckIn(date, map, today);
  }

  function pick(date: string) {
    if (choosingCheckout && date > checkin) {
      onChange(checkin, date);
      onDone();
    } else {
      onChange(date, '');
    }
  }

  // Grid cells for the visible month, padded to start on Sunday.
  const first = new Date(`${month}T00:00:00Z`).getUTCDay();
  const last = endOfMonth(month);
  const cells: (string | null)[] = Array.from({ length: first }, () => null);
  for (let d = month; d <= last; d = addDays(d, 1)) cells.push(d);

  return (
    <div className="drp" role="group" aria-label="Choose dates">
      <div className="drp-head">
        <button type="button" className="drp-nav" aria-label="Previous month" disabled={month <= startOfMonth(today)} onClick={() => setMonth(addMonths(month, -1))}>
          ‹
        </button>
        <div className="drp-title" aria-live="polite">
          {monthLabel(month)}
        </div>
        <button type="button" className="drp-nav" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
          ›
        </button>
      </div>
      <div className="drp-grid">
        {DOW.map((d) => (
          <div key={d} className="drp-dow" aria-hidden="true">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} />;
          const edge = date === checkin || date === checkout;
          const inRange = checkin && checkout && date > checkin && date < checkout;
          const disabled = isDisabled(date);
          return (
            <button
              type="button"
              key={date}
              className={`drp-day${edge ? ' edge' : ''}${inRange ? ' in-range' : ''}`}
              disabled={disabled}
              aria-pressed={edge}
              aria-label={`${fullLabel(date)}${disabled ? ', unavailable' : ''}`}
              onClick={() => pick(date)}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="drp-foot">
        <span className="drp-loading">
          {failed
            ? 'Couldn’t load availability. You can still pick dates.'
            : loading
              ? 'Loading availability…'
              : choosingCheckout
                ? minStay
                  ? `Choose check-out · ${minStay}-night minimum`
                  : 'Choose check-out'
                : 'Choose check-in'}
        </span>
        {checkin ? (
          <button type="button" className="btn-link" onClick={() => onChange('', '')}>
            Clear dates
          </button>
        ) : null}
      </div>
    </div>
  );
}
