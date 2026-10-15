import { PROPERTIES } from '@/data/properties';
import { SITE } from '@/data/site';
import type { Attraction, Property } from '@/data/types';
import { isIsoDate } from '@/lib/dates';

/**
 * URL state shared by the search bar, results page and property pages:
 * ?where=&checkin=&checkout=&adults=&amenities=court,pets
 */

export type SearchState = {
  where: string;
  checkin: string;
  checkout: string;
  adults: number;
  amenities: string[];
};

export const AMENITY_FILTERS: { id: string; label: string; test: (p: Property) => boolean }[] = [
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

/** How well a stay fits the search's place and amenities: one point for each it has. */
export function matchScore(p: Property, state: SearchState): number {
  const place = attractionById(state.where);
  const near = place && p.nearby.includes(place.id) ? 1 : 0;
  return near + state.amenities.filter((id) => AMENITY_FILTERS.find((f) => f.id === id)?.test(p)).length;
}

/**
 * The stays for a search. The group size is a hard limit (a house that sleeps
 * 12 can't take 20), but the place and amenities only rank: every home is a
 * short drive from the others and sleeps a big group, so all that fit are
 * shown, best matches first and the rest in the usual order.
 */
export function rankProperties(state: SearchState): Property[] {
  return PROPERTIES.map((p, i) => ({ p, i, score: matchScore(p, state) }))
    .filter(({ p }) => p.guests >= state.adults)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ p }) => p);
}

export function toggleAmenity(state: SearchState, id: string): SearchState {
  if (id === 'clear') return { ...state, amenities: [] };
  const amenities = state.amenities.includes(id) ? state.amenities.filter((a) => a !== id) : [...state.amenities, id];
  return { ...state, amenities };
}
