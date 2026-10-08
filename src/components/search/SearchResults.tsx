'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getPropertyBySlug } from '@/data/properties';
import type { Property } from '@/data/types';
import type { SearchResult } from '@/lib/booking/types';
import { wholeDollars } from '@/lib/format';
import { stayQuery, type SearchState } from '@/lib/search-params';
import { PropertyCard } from '@/components/property/PropertyCard';
import { Ph } from '@/components/ui/Ph';

type Props = {
  /** Slugs that pass the where / guests / amenity filters (computed on the server). */
  slugs: string[];
  state: SearchState;
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
export function SearchResults({ slugs, state, nearName, heading, filters, everyEstate }: Props) {
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

  return (
    <div className="results">
      <section className="results-list">
        <div className="results-head">{heading}</div>
        {filters}
        <p className="every-estate">Every estate includes: {everyEstate}</p>
        <p className="results-status" aria-live="polite">
          {!hasStay
            ? 'Add dates and guests to see live availability and prices.'
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
              <PropertyCard key={p.id} property={p} query={query} nearName={nearName} result={bySlug?.get(p.slug)} onHover={setHovered} />
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
          const price = r?.nightlyAverage != null ? wholeDollars(r.nightlyAverage, r.currency) : `$${p.priceFrom}`;
          return (
            <Link
              key={p.id}
              className={`pin${hovered === p.id ? ' active' : ''}`}
              style={{ left: `${p.mapPos.x}%`, top: `${p.mapPos.y}%` }}
              href={`/stays/${p.slug}${query}`}
              aria-label={`${p.name}, ${price} per night`}
            >
              {price}
            </Link>
          );
        })}
      </aside>
    </div>
  );
}
