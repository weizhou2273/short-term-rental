import type { GuestCount } from './types';
import { totalGuests } from './types';

/**
 * Presentation helpers that both server components and client components need.
 *
 * They live here rather than beside the client components that also use them:
 * a function exported from a `'use client'` module cannot be *called* from the
 * server, only rendered as a component or passed as a prop, so sharing one from
 * there fails at runtime rather than at build time.
 */

/** "4 guests, 1 infant, 2 pets" — infants and pets are called out separately. */
export function guestSummary(guests: GuestCount): string {
  const parts: string[] = [];
  const people = totalGuests(guests);
  parts.push(`${people} guest${people === 1 ? '' : 's'}`);
  if (guests.infants > 0) {
    parts.push(`${guests.infants} infant${guests.infants === 1 ? '' : 's'}`);
  }
  if (guests.pets > 0) {
    parts.push(`${guests.pets} pet${guests.pets === 1 ? '' : 's'}`);
  }
  return parts.join(', ');
}
