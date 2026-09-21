import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clientKey, rateLimit, resetRateLimits } from '@/lib/api/rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useRealTimers();
  });

  it('allows requests up to the limit', () => {
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit('key', 3, 1_000).ok).toBe(true);
    }
    expect(rateLimit('key', 3, 1_000).ok).toBe(false);
  });

  it('reports the remaining budget', () => {
    expect(rateLimit('key', 3, 1_000).remaining).toBe(2);
    expect(rateLimit('key', 3, 1_000).remaining).toBe(1);
    expect(rateLimit('key', 3, 1_000).remaining).toBe(0);
  });

  it('keeps separate budgets per key', () => {
    expect(rateLimit('a', 1, 1_000).ok).toBe(true);
    expect(rateLimit('b', 1, 1_000).ok).toBe(true);
    expect(rateLimit('a', 1, 1_000).ok).toBe(false);
  });

  it('resets once the window has passed', () => {
    vi.useFakeTimers();
    expect(rateLimit('key', 1, 1_000).ok).toBe(true);
    expect(rateLimit('key', 1, 1_000).ok).toBe(false);
    vi.advanceTimersByTime(1_001);
    expect(rateLimit('key', 1, 1_000).ok).toBe(true);
  });

  it('surfaces a retry-after once blocked', () => {
    rateLimit('key', 1, 60_000);
    const blocked = rateLimit('key', 1, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });
});

describe('clientKey', () => {
  const req = (headers: Record<string, string>) =>
    new Request('https://example.com', { headers });

  it('takes the left-most forwarded address', () => {
    expect(clientKey(req({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }), 'quote')).toBe(
      'quote:203.0.113.7',
    );
  });

  it('falls back to x-real-ip, then to a constant', () => {
    expect(clientKey(req({ 'x-real-ip': '198.51.100.4' }), 'quote')).toBe(
      'quote:198.51.100.4',
    );
    expect(clientKey(req({}), 'quote')).toBe('quote:unknown');
  });

  it('scopes keys so one endpoint cannot exhaust another', () => {
    const headers = { 'x-forwarded-for': '203.0.113.7' };
    expect(clientKey(req(headers), 'quote')).not.toBe(clientKey(req(headers), 'booking'));
  });
});
