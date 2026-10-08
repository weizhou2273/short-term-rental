/**
 * Fixed-window rate limiter keyed by client IP.
 *
 * State lives in the memory of one server instance. On Vercel that means each
 * warm function instance keeps its own counts, so the effective limit across
 * the fleet is higher than configured. That is enough to stop a script
 * hammering /api/quote from one browser; for a hard global limit, back this
 * with a shared store (Upstash Redis / Vercel KV) behind the same interface.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
};

type Bucket = { count: number; resetAt: number };

export type RateLimiter = {
  check(key: string, now?: number): RateLimitResult;
};

export function createRateLimiter({ limit, windowMs, maxKeys = 10_000 }: { limit: number; windowMs: number; maxKeys?: number }): RateLimiter {
  const buckets = new Map<string, Bucket>();

  function sweep(now: number) {
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  }

  return {
    check(key, now = Date.now()) {
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        if (buckets.size >= maxKeys) sweep(now);
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      return {
        allowed: bucket.count <= limit,
        remaining: Math.max(0, limit - bucket.count),
        retryAfter,
      };
    },
  };
}

/** Client IP as Vercel reports it. Falls back to a shared key when absent. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}
