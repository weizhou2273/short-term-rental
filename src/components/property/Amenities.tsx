'use client';

import { useState } from 'react';
import type { Amenity } from '@/lib/booking/types';

/**
 * Amenity icons are matched on keyword rather than an exhaustive map: OwnerRez
 * amenity vocabularies differ per account, so a fuzzy match degrades to a
 * neutral dot instead of rendering nothing.
 */
const ICONS: { match: RegExp; path: string }[] = [
  { match: /wi-?fi|internet|starlink/i, path: 'M2 7a12 12 0 0 1 16 0M5 10.5a7 7 0 0 1 10 0M8 14a2.5 2.5 0 0 1 4 0' },
  { match: /hot tub|pool|sauna|bath|tub/i, path: 'M3 12h14v3a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-3ZM6 12V5a2 2 0 0 1 4 0' },
  { match: /fire|stove|wood|pizza oven/i, path: 'M10 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s1 1 1 2c0-3 2-7 2-7Z' },
  { match: /kitchen|chef|espresso|coffee/i, path: 'M4 4h9v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V4ZM13 6h2a2 2 0 0 1 0 4h-2M3 17h12' },
  { match: /park|car|garage/i, path: 'M3 12h14l-1.5-4.5A2 2 0 0 0 13.6 6H6.4a2 2 0 0 0-1.9 1.5L3 12Zm0 0v4h2v-2m12 2v-4m0 4h-2v-2' },
  { match: /pet|dog/i, path: 'M6 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm8 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM10 17c-3 0-4-1.5-4-3s1.8-3 4-3 4 1.5 4 3-1 3-4 3Z' },
  { match: /wash|dry|laundry/i, path: 'M4 3h12v14H4V3Zm6 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z' },
  { match: /air|heat|radiant|condition/i, path: 'M10 2v16M4 6l12 8M16 6 4 14' },
  { match: /desk|work|office/i, path: 'M3 5h14v8H3V5Zm2 8v4m10-4v4M7 17h6' },
  { match: /garden|orchard|acre|trail|hik/i, path: 'M10 18V9m0 0L6 5m4 4 4-4M6 12l4 3 4-3' },
  { match: /bike|bicycle/i, path: 'M5.5 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm9 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-9-3 3-6h3l3 6' },
  { match: /solar|power/i, path: 'M10 3v2m0 10v2m7-7h-2M5 10H3m11.9-4.9-1.4 1.4M6.5 13.5l-1.4 1.4m0-9.8 1.4 1.4m7 7 1.4 1.4M13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' },
  { match: /shower/i, path: 'M4 10h12M6 10V5a3 3 0 0 1 6 0M7 14v1m3-2v2m3-3v1' },
  { match: /record|music|library|book/i, path: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z' },
];

function iconFor(label: string): string {
  return ICONS.find((icon) => icon.match.test(label))?.path ?? 'M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z';
}

export function Amenities({ amenities }: { amenities: Amenity[] }) {
  const [expanded, setExpanded] = useState(false);
  if (amenities.length === 0) return null;

  const INITIAL = 8;
  const visible = expanded ? amenities : amenities.slice(0, INITIAL);

  return (
    <div>
      <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {visible.map((amenity) => (
          <li key={amenity.key} className="flex items-center gap-3 text-sm text-[var(--color-ink-muted)]">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
              className="shrink-0 text-[var(--color-ink-faint)]"
            >
              <path
                d={iconFor(amenity.label)}
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {amenity.label}
          </li>
        ))}
      </ul>

      {amenities.length > INITIAL ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-6 text-[0.8125rem] text-[var(--color-ink)] underline decoration-[var(--color-line-strong)] underline-offset-4 transition-colors hover:decoration-[var(--color-accent)]"
        >
          {expanded ? 'Show fewer' : `Show all ${amenities.length}`}
        </button>
      ) : null}
    </div>
  );
}
