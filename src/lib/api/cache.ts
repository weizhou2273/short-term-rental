import { revalidateTag } from 'next/cache';

/**
 * Expires a cache tag immediately.
 *
 * Next 16 requires an explicit cache-life profile on `revalidateTag`; every
 * caller here is a webhook reacting to something that has already happened
 * upstream, so the only correct profile is "stale right now". A night sold on
 * an OTA must not remain bookable here for even a short grace window.
 */
export function expireTag(tag: string): void {
  revalidateTag(tag, { expire: 0 });
}
