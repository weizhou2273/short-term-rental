/**
 * In-memory fixed-window rate limiter.
 *
 * Deliberately simple and deliberately per-instance: it is enough to stop a
 * single client hammering the quote endpoint (which costs an upstream OwnerRez
 * call) or spraying the inquiry form. It is NOT a defence against a distributed
 * attacker, and on a multi-instance deployment each instance keeps its own
 * counters. Put Redis, Upstash or the platform's own WAF in front for that —
 * see the deployment notes in the README.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets, for `Retry-After`. */
  retryAfter: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    // Opportunistic sweep so a long-lived instance cannot grow unbounded.
    if (buckets.size > MAX_BUCKETS) {
      for (const [id, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(id);
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  return {
    ok: bucket.count <= limit,
    remaining,
    retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/**
 * Best-effort client identity. `x-forwarded-for` is spoofable in general, but
 * on Vercel, Netlify and behind most reverse proxies the left-most entry is
 * rewritten by the edge and is the closest thing to a real client address.
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return `${scope}:${ip}`;
}

/** Test seam — the limiter is module-level state. */
export function resetRateLimits(): void {
  buckets.clear();
}
