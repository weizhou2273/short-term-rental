import Link from 'next/link';
import { AMENITY_FILTERS, toggleAmenity, toQueryString, type SearchState } from '@/lib/search-params';

/** Toggle chips. Each is a plain link to the toggled URL, so filtering works without JavaScript. */
export function AmenityFilters({ state }: { state: SearchState }) {
  return (
    <div className="filters" role="group" aria-label="Filter by amenity">
      {AMENITY_FILTERS.map((f) => {
        const on = state.amenities.includes(f.id);
        return (
          <Link
            key={f.id}
            className={`chip${on ? ' on' : ''}`}
            aria-pressed={on}
            role="button"
            href={`/search${toQueryString(toggleAmenity(state, f.id))}`}
            scroll={false}
            replace
          >
            {f.label}
          </Link>
        );
      })}
      {state.amenities.length ? (
        <Link className="btn-link" style={{ fontSize: 13 }} href={`/search${toQueryString(toggleAmenity(state, 'clear'))}`} scroll={false} replace>
          Clear
        </Link>
      ) : null}
    </div>
  );
}
