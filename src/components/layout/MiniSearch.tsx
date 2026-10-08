'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatShortDate } from '@/lib/dates';
import { plural } from '@/lib/format';
import { attractionById, parseSearchState, toQueryString } from '@/lib/search-params';

/** Compact search summary in the property-page header; links back to /search with the same query. */
export function MiniSearch() {
  const state = parseSearchState(useSearchParams());
  const where = attractionById(state.where)?.name ?? 'Anywhere in the Poconos';
  const when = state.checkin && state.checkout ? `${formatShortDate(state.checkin)} – ${formatShortDate(state.checkout)}` : 'Any week';
  const guests = state.adults ? plural(state.adults, 'guest') : 'Add guests';
  return (
    <Link className="mini-search" href={`/search${toQueryString(state)}`}>
      <span>{where}</span>
      <span>{when}</span>
      <span className="muted">{guests}</span>
      <b aria-hidden="true">⌕</b>
      <span className="sr-only">Change search</span>
    </Link>
  );
}
