'use client';

import { useEffect, useRef, useState } from 'react';
import type { GuestCount, Property } from '@/lib/booking/types';
import { guestSummary } from '@/lib/booking/format';
import { cn } from '@/lib/util/cn';

type Row = {
  key: keyof GuestCount;
  label: string;
  hint: string;
  min: number;
};

export function GuestPicker({
  property,
  value,
  onChange,
}: {
  property: Property;
  value: GuestCount;
  onChange: (value: GuestCount) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape — a popover that traps the page is worse
  // than no popover at all.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const rows: Row[] = [
    { key: 'adults', label: 'Adults', hint: '13 and over', min: 1 },
    { key: 'children', label: 'Children', hint: 'Ages 2–12', min: 0 },
    { key: 'infants', label: 'Infants', hint: 'Under 2, not counted', min: 0 },
    ...(property.rules.petsAllowed
      ? [{ key: 'pets' as const, label: 'Pets', hint: 'Fee applies per stay', min: 0 }]
      : []),
  ];

  function limitFor(key: keyof GuestCount): number {
    if (key === 'infants') return 5;
    if (key === 'pets') return 2;
    // Adults and children share the occupancy cap.
    const others = key === 'adults' ? value.children : value.adults;
    return Math.max(1, property.capacity.maxGuests - others);
  }

  function adjust(key: keyof GuestCount, delta: number) {
    const row = rows.find((item) => item.key === key);
    if (!row) return;
    const next = Math.min(limitFor(key), Math.max(row.min, value[key] + delta));
    if (next === value[key]) return;
    onChange({ ...value, [key]: next });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-11 w-full items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3.5 text-left text-[0.9375rem] text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
      >
        <span>{guestSummary(value)}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className={cn('transition-transform duration-200', open && 'rotate-180')}
        >
          <path d="m2 4 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Guests"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-float)]"
        >
          {rows.map((row) => {
            const atMax = value[row.key] >= limitFor(row.key);
            const atMin = value[row.key] <= row.min;
            return (
              <div
                key={row.key}
                className="flex items-center justify-between border-b border-[var(--color-line)] py-3 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">{row.label}</p>
                  <p className="text-xs text-[var(--color-ink-faint)]">{row.hint}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Stepper
                    label={`Decrease ${row.label}`}
                    disabled={atMin}
                    onClick={() => adjust(row.key, -1)}
                    symbol="−"
                  />
                  <span className="w-5 text-center text-sm tabular text-[var(--color-ink)]">
                    {value[row.key]}
                  </span>
                  <Stepper
                    label={`Increase ${row.label}`}
                    disabled={atMax}
                    onClick={() => adjust(row.key, 1)}
                    symbol="+"
                  />
                </div>
              </div>
            );
          })}
          <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
            This home sleeps {property.capacity.maxGuests}.
            {property.rules.petsAllowed ? '' : ' It cannot accommodate pets.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Stepper({
  label,
  symbol,
  disabled,
  onClick,
}: {
  label: string;
  symbol: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-line-strong)] text-sm text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:opacity-30 disabled:hover:border-[var(--color-line-strong)]"
    >
      {symbol}
    </button>
  );
}
