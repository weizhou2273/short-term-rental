'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getPropertyBySlug } from '@/data/properties';
import type { Property } from '@/data/types';
import type { SearchResult, SuggestedStay } from '@/lib/booking/types';
import { nightsBetween } from '@/lib/dates';
import { wholeDollars } from '@/lib/format';
import { stayQuery, type SearchState } from '@/lib/search-params';
import { PropertyCard } from '@/components/property/PropertyCard';
import { Ph } from '@/components/ui/Ph';

type Props = {
  /** Slugs that pass the where / guests / amenity filters (computed on the server). */
  slugs: string[];
  state: SearchState;
  /** Without dates: each property's next open stay and its price. */
  suggested: Record<string, SuggestedStay>;
  nearName?: string;
  heading: React.ReactNode;
  filters: React.ReactNode;
  everyEstate: string;
};

type Live =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; bySlug: Map<string, SearchResult> }
  | { status: 'error'; message: string };

/**
 * Results list + map. With dates and guests in the URL, asks /api/search for
 * live availability and pre-tax totals; available stays sort first.
 */
export function SearchResults({ slugs, state, suggested, nearName, heading, filters, everyEstate }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const hasStay = Boolean(state.checkin && state.checkout && state.adults);
  const [live, setLive] = useState<Live>({ status: 'idle' });

  useEffect(() => {
    if (!hasStay) return;
    const controller = new AbortController();
    const q = new URLSearchParams({ checkin: state.checkin, checkout: state.checkout, adults: String(state.adults) });
    // Starting a new request supersedes the previous result.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLive({ status: 'loading' });
    fetch(`/api/search?${q}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Couldn’t check availability.');
        const results = body.results as SearchResult[];
        setLive({ status: 'done', bySlug: new Map(results.map((r) => [r.slug, r])) });
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setLive({ status: 'error', message: err.message });
      });
    return () => controller.abort();
  }, [hasStay, state.checkin, state.checkout, state.adults]);

  const bySlug = hasStay && live.status === 'done' ? live.bySlug : null;
  const properties = slugs.map(getPropertyBySlug).filter((p): p is Property => Boolean(p));
  if (bySlug) {
    // Available first, keeping the curated order within each group.
    properties.sort((a, b) => Number(bySlug.get(b.slug)?.available ?? false) - Number(bySlug.get(a.slug)?.available ?? false));
  }
  const availableCount = bySlug ? properties.filter((p) => bySlug.get(p.slug)?.available).length : null;
  const query = stayQuery(state);
  const nights = hasStay ? nightsBetween(state.checkin, state.checkout) : undefined;
  const priced = !hasStay && Object.keys(suggested).length > 0;
  // A suggested stay opens the property with those dates, keeping any guest count.
  const cardQuery = (slug: string) => {
    const s = hasStay ? undefined : suggested[slug];
    return s ? stayQuery({ checkin: s.checkin, checkout: s.checkout, adults: state.adults || 1 }) : query;
  };

  return (
    <div className="results">
      <section className="results-list">
        <div className="results-head">{heading}</div>
        {filters}
        <p className="every-estate">Every estate includes: {everyEstate}</p>
        <p className="results-status" aria-live="polite">
          {!hasStay
            ? priced
              ? 'Prices are for the dates shown and include all fees, before taxes. Add your dates for exact prices.'
              : 'Add dates and guests to see live availability and prices.'
            : live.status === 'loading'
              ? 'Checking availability…'
              : live.status === 'error'
                ? live.message
                : availableCount !== null
                  ? `${availableCount} of ${properties.length} available for your dates.`
                  : ''}
        </p>
        {properties.length ? (
          <div className="grid-cards">
            {properties.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                query={cardQuery(p.slug)}
                nearName={nearName}
                result={bySlug?.get(p.slug)}
                nights={nights}
                suggested={hasStay ? undefined : suggested[p.slug]}
                onHover={setHovered}
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>No estates match all of those</h3>
            <p className="muted" style={{ margin: '6px 0 14px' }}>
              Try removing a filter or choosing a different attraction.
            </p>
            <Link className="btn" href="/search">
              Clear search
            </Link>
          </div>
        )}
      </section>
      <aside className="map" aria-label="Map">
        <Ph label="Map placeholder (Mapbox / Google Maps)" />
        {properties.map((p) => {
          const r = bySlug?.get(p.slug);
          if (r && !r.available) return null;
          const s = hasStay ? undefined : suggested[p.slug];
          const total =
            r?.totalWithoutTaxes != null ? wholeDollars(r.totalWithoutTaxes, r.currency) : s ? wholeDollars(s.total, s.currency) : null;
          return (
            <Link
              key={p.id}
              className={`pin${hovered === p.id ? ' active' : ''}`}
              style={{ left: `${p.mapPos.x}%`, top: `${p.mapPos.y}%` }}
              href={`/stays/${p.slug}${cardQuery(p.slug)}`}
              aria-label={total ? `${p.name}, ${total} total before taxes` : p.name}
            >
              {total ?? p.name}
            </Link>
          );
        })}
      </aside>
    </div>
  );
}
