/**
 * Prevents one booking reference producing two reservations.
 *
 * A guest can confirm from the browser at the same moment the payment webhook
 * fires, and both paths create the reservation. This guard makes the second one
 * a no-op.
 *
 * IMPORTANT: the store is in-process. That is correct for a single instance and
 * insufficient for a horizontally scaled deployment, where two instances hold
 * separate maps and a race can still double-book. Before scaling out, swap
 * `claim`/`release` for a shared store with an atomic set-if-absent — Redis
 * `SET key NX PX`, or a unique index on the reference in a database. The README
 * covers this under "Going to production".
 */

type Claim = { at: number; bookingId: string | null };

const claims = new Map<string, Claim>();
const TTL_MS = 60 * 60 * 1000;

function sweep(now: number): void {
  for (const [key, claim] of claims) {
    if (now - claim.at > TTL_MS) claims.delete(key);
  }
}

export type ClaimResult =
  | { claimed: true }
  | { claimed: false; bookingId: string | null };

/** Takes the reference, or reports who already holds it. */
export function claim(reference: string): ClaimResult {
  const now = Date.now();
  sweep(now);
  const existing = claims.get(reference);
  if (existing) return { claimed: false, bookingId: existing.bookingId };
  claims.set(reference, { at: now, bookingId: null });
  return { claimed: true };
}

/** Records the resulting reservation so a duplicate call can return it. */
export function settle(reference: string, bookingId: string | null): void {
  const existing = claims.get(reference);
  claims.set(reference, { at: existing?.at ?? Date.now(), bookingId });
}

/** Releases a failed attempt so the guest can retry with the same reference. */
export function release(reference: string): void {
  claims.delete(reference);
}

/** Test seam. */
export function resetClaims(): void {
  claims.clear();
}
