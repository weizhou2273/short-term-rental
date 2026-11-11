import type { GuestReview } from '@/data/types';

/**
 * Every home's review history, from Hospitable (Airbnb, plus the odd
 * Booking.com stay), exported on 2026-11-11. Each <slug>.json holds the
 * reviews that are rated 4 or 5 stars and have a written English comment of
 * at least a sentence, newest first, with the guest's first name only and
 * the public text as written (never the private feedback).
 *
 * Only 4- and 5-star reviews are shown, so the page says so: the home's
 * rating and review count (in src/data/properties.ts) come from ALL its
 * reviews, which the counts below record.
 *
 * The lists load only when a guest opens them, so they add nothing to the
 * page itself.
 */

export type ReviewHistory = {
  /** Reviews in the list. */
  shown: number;
  /** Of those, the 4-star ones. */
  fourStar: number;
  /** Month of the oldest review in the list. */
  since: string;
  /** Every rated review of the home, any star count, and their average. */
  allReviews: number;
  average: number;
  load: () => Promise<GuestReview[]>;
};

const list = (m: { default: GuestReview[] }) => m.default;

export const REVIEW_HISTORY: Record<string, ReviewHistory> = {
  'shawnee-estate': {
    shown: 49,
    fourStar: 1,
    since: 'November 2025',
    allReviews: 59,
    average: 4.9661,
    load: () => import('./shawnee-estate.json').then(list),
  },
  'minsi-pond': {
    shown: 313,
    fourStar: 14,
    since: 'February 2021',
    allReviews: 356,
    average: 4.9354,
    load: () => import('./minsi-pond.json').then(list),
  },
  'the-ridge': {
    shown: 107,
    fourStar: 2,
    since: 'April 2024',
    allReviews: 139,
    average: 4.8777,
    load: () => import('./the-ridge.json').then(list),
  },
  'the-clearview': {
    shown: 272,
    fourStar: 22,
    since: 'September 2021',
    allReviews: 334,
    average: 4.8772,
    load: () => import('./the-clearview.json').then(list),
  },
  'clover-lodge': {
    shown: 352,
    fourStar: 26,
    since: 'July 2020',
    allReviews: 436,
    average: 4.8807,
    load: () => import('./clover-lodge.json').then(list),
  },
};
