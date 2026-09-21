'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { cn } from '@/lib/util/cn';

/**
 * Filters write to the URL rather than local state, so a filtered list can be
 * shared, bookmarked and crawled. The server component above re-renders from
 * `searchParams`; this component holds no state of its own.
 */
export function PropertyFilters({ maxGuests }: { maxGuests: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null) next.delete(key);
      else next.set(key, value);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const guests = params.get('guests');
  const pets = params.get('pets') === '1';
  const bedrooms = params.get('bedrooms');
  const hasFilters = Boolean(guests || pets || bedrooms);

  const guestOptions = [2, 4, 6, 8].filter((value) => value <= maxGuests);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <FilterGroup label="Sleeps">
        {guestOptions.map((option) => (
          <Chip
            key={option}
            active={guests === String(option)}
            onClick={() => setParam('guests', guests === String(option) ? null : String(option))}
          >
            {option}+
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup label="Bedrooms">
        {[1, 2, 3, 4].map((option) => (
          <Chip
            key={option}
            active={bedrooms === String(option)}
            onClick={() =>
              setParam('bedrooms', bedrooms === String(option) ? null : String(option))
            }
          >
            {option}+
          </Chip>
        ))}
      </FilterGroup>

      <Chip active={pets} onClick={() => setParam('pets', pets ? null : '1')}>
        Dog friendly
      </Chip>

      {hasFilters ? (
        <button
          type="button"
          onClick={() => router.replace(pathname, { scroll: false })}
          className="ml-1 text-[0.8125rem] text-[var(--color-ink-muted)] underline underline-offset-4 transition-colors hover:text-[var(--color-ink)]"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 text-xs text-[var(--color-ink-faint)]">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-[0.8125rem] transition-colors duration-200',
        active
          ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-canvas)]'
          : 'border-[var(--color-line-strong)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
      )}
    >
      {children}
    </button>
  );
}
