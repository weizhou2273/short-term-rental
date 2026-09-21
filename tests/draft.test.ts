import { beforeEach, describe, expect, it } from 'vitest';

// The signing key must be in place before `lib/config/env` caches the
// environment, so it is set before the modules under test are imported.
process.env.BOOKING_SIGNING_SECRET = 'test-secret-that-is-at-least-32-characters-long';

const { signDraft, verifyDraft, DRAFT_TTL_SECONDS } = await import('@/lib/booking/draft');
const { claim, release, resetClaims, settle } = await import('@/lib/booking/idempotency');

function draftFixture(overrides: Record<string, unknown> = {}) {
  return {
    reference: 'ABCD-2345',
    propertyId: 101,
    propertySlug: 'the-glass-barn',
    arrival: '2026-07-01',
    departure: '2026-07-04',
    guests: { adults: 2, children: 0, infants: 0, pets: 0 },
    guest: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '+1 555 0100',
    },
    totalAmount: 250_000,
    dueNowAmount: 125_000,
    currency: 'USD',
    issuedAt: Math.floor(Date.now() / 1000),
    ...overrides,
  } as Parameters<typeof signDraft>[0];
}

describe('booking drafts', () => {
  it('round-trips a valid draft', () => {
    const draft = draftFixture();
    const result = verifyDraft(signDraft(draft));
    expect(result.ok).toBe(true);
    expect(result.ok && result.draft).toEqual(draft);
  });

  it('rejects a tampered payload', () => {
    const token = signDraft(draftFixture());
    const [payload, signature] = token.split('.');

    // Re-encode the payload with a discounted price and keep the old signature.
    const decoded = JSON.parse(
      Buffer.from(payload!.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(),
    );
    decoded.dueNowAmount = 1;
    const forged = Buffer.from(JSON.stringify(decoded))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = verifyDraft(`${forged}.${signature}`);
    expect(result).toEqual({ ok: false, reason: 'signature' });
  });

  it('rejects a tampered signature', () => {
    const token = signDraft(draftFixture());
    const [payload] = token.split('.');
    expect(verifyDraft(`${payload}.not-a-signature`).ok).toBe(false);
  });

  it('rejects a malformed token without throwing', () => {
    expect(verifyDraft('').ok).toBe(false);
    expect(verifyDraft('nodot').ok).toBe(false);
    expect(verifyDraft('a.b.c').ok).toBe(false);
  });

  it('rejects an expired draft', () => {
    const stale = draftFixture({
      issuedAt: Math.floor(Date.now() / 1000) - DRAFT_TTL_SECONDS - 60,
    });
    expect(verifyDraft(signDraft(stale))).toEqual({ ok: false, reason: 'expired' });
  });

  it('accepts a draft right at the edge of the window', () => {
    const edge = draftFixture({
      issuedAt: Math.floor(Date.now() / 1000) - DRAFT_TTL_SECONDS + 5,
    });
    expect(verifyDraft(signDraft(edge)).ok).toBe(true);
  });
});

describe('idempotency', () => {
  beforeEach(() => resetClaims());

  it('lets the first caller through and blocks the second', () => {
    expect(claim('ABCD-2345')).toEqual({ claimed: true });
    expect(claim('ABCD-2345')).toEqual({ claimed: false, bookingId: null });
  });

  it('hands the booking id to a duplicate once settled', () => {
    claim('ABCD-2345');
    settle('ABCD-2345', '99123');
    expect(claim('ABCD-2345')).toEqual({ claimed: false, bookingId: '99123' });
  });

  it('allows a retry after a released failure', () => {
    claim('ABCD-2345');
    release('ABCD-2345');
    expect(claim('ABCD-2345')).toEqual({ claimed: true });
  });

  it('keeps references independent', () => {
    expect(claim('ABCD-2345').claimed).toBe(true);
    expect(claim('EFGH-6789').claimed).toBe(true);
  });
});
