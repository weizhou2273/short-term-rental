import { PROPERTIES } from '@/data/properties';
import { SITE } from '@/data/site';
import type { Attraction, Property } from '@/data/types';
import { isIsoDate } from '@/lib/dates';

/**
 * URL state shared by the search bar, results page and property pages:
 * ?where=&checkin=&checkout=&adults=&amenities=pool,pets
 */

export type SearchState = {
  where: string;
  checkin: string;
  checkout: string;
  adults: number;
  amenities: string[];
};

export const AMENITY_FILTERS: { id: string; label: string; test: (p: Property) => boolean }[] = [
  { id: 'pool', label: 'Private pool', test: (p) => p.features.privatePool },
  { id: 'court', label: 'Pickleball / tennis', test: (p) => p.features.sportCourt },
  { id: 'water', label: 'Waterfront', test: (p) => p.features.waterfront },
  { id: 'pets', label: 'Pet friendly', test: (p) => p.features.petFriendly },
  { id: 'big', label: 'Sleeps 16+', test: (p) => p.guests >= 16 },
];

export const attractionById = (id: string | undefined): Attraction | undefined =>
  id ? SITE.attractions.find((a) => a.id === id) : undefined;

export const MAX_GUESTS = Math.max(...PROPERTIES.map((p) => p.guests));

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function parseSearchState(raw: RawParams | URLSearchParams): SearchState {
  const get = (k: string) => (raw instanceof URLSearchParams ? raw.get(k) ?? '' : first(raw[k]));
  const checkin = get('checkin');
  const checkout = get('checkout');
  const adults = Number.parseInt(get('adults'), 10);
  const known = new Set(AMENITY_FILTERS.map((f) => f.id));
  return {
    where: attractionById(get('where')) ? get('where') : '',
    checkin: isIsoDate(checkin) ? checkin : '',
    checkout: isIsoDate(checkout) ? checkout : '',
    adults: Number.isFinite(adults) && adults > 0 ? Math.min(adults, MAX_GUESTS) : 0,
    amenities: get('amenities').split(',').filter((a) => known.has(a)),
  };
}

/** Query string for links, keeping only the keys that are set. */
export function toQueryString(state: Partial<SearchState>, keys: (keyof SearchState)[] = ['where', 'checkin', 'checkout', 'adults', 'amenities']): string {
  const q = new URLSearchParams();
  for (const key of keys) {
    const value = state[key];
    if (Array.isArray(value)) {
      if (value.length) q.set(key, value.join(','));
    } else if (value) {
      q.set(key, String(value));
    }
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** The subset a property page cares about. */
export const stayQuery = (state: Partial<SearchState>) => toQueryString(state, ['checkin', 'checkout', 'adults']);

export function filterProperties(state: SearchState): Property[] {
  const place = attractionById(state.where);
  return PROPERTIES.filter(
    (p) =>
      (!place || p.nearby.includes(place.id)) &&
      p.guests >= state.adults &&
      state.amenities.every((id) => AMENITY_FILTERS.find((f) => f.id === id)?.test(p)),
  );
}

export function toggleAmenity(state: SearchState, id: string): SearchState {
  if (id === 'clear') return { ...state, amenities: [] };
  const amenities = state.amenities.includes(id) ? state.amenities.filter((a) => a !== id) : [...state.amenities, id];
  return { ...state, amenities };
}
