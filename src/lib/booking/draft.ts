import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { env } from '@/lib/config/env';
import { guestCountSchema, guestDetailsSchema, isoDateSchema } from './validation';

/**
 * A signed, short-lived description of the stay a guest is about to pay for.
 *
 * Checkout spans two requests — start the payment, then confirm it — and the
 * second must not be able to change what the first agreed to. Rather than
 * introduce a database purely to hold a few seconds of state, the draft is
 * serialised, HMAC-signed and handed to the client. On confirmation the server
 * verifies the signature, so a guest cannot edit the dates, the price or the
 * property between paying and being booked.
 *
 * The token carries no secret of its own and is only meaningful next to a
 * verified payment, so exposing it to the browser is safe.
 */

export const bookingDraftSchema = z.object({
  reference: z.string().min(4).max(32),
  propertyId: z.number().int().positive(),
  propertySlug: z.string().min(1).max(120),
  arrival: isoDateSchema,
  departure: isoDateSchema,
  guests: guestCountSchema,
  guest: guestDetailsSchema,
  /** Minor units, as quoted server-side. */
  totalAmount: z.number().int().nonnegative(),
  dueNowAmount: z.number().int().nonnegative(),
  currency: z.string().length(3),
  /** Unix seconds. */
  issuedAt: z.number().int().positive(),
});

export type BookingDraft = z.infer<typeof bookingDraftSchema>;

/** Drafts expire well inside a normal checkout, and long before a rate moves. */
export const DRAFT_TTL_SECONDS = 45 * 60;

let ephemeralSecret: string | null = null;

function signingSecret(): string {
  const configured = env().BOOKING_SIGNING_SECRET;
  if (configured) return configured;

  if (env().NODE_ENV === 'production') {
    throw new Error(
      'BOOKING_SIGNING_SECRET must be set in production. Generate one with: openssl rand -base64 48',
    );
  }

  // Development convenience only. A per-process key means drafts do not survive
  // a restart, which is fine locally and unacceptable across instances.
  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(48).toString('base64');
    console.warn(
      '[booking] BOOKING_SIGNING_SECRET is unset; using an ephemeral development key.',
    );
  }
  return ephemeralSecret;
}

function base64Url(value: Buffer | string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function signDraft(draft: BookingDraft): string {
  const payload = base64Url(JSON.stringify(draft));
  const signature = base64Url(
    createHmac('sha256', signingSecret()).update(payload).digest(),
  );
  return `${payload}.${signature}`;
}

export type DraftVerification =
  | { ok: true; draft: BookingDraft }
  | { ok: false; reason: 'malformed' | 'signature' | 'expired' };

export function verifyDraft(token: string): DraftVerification {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return { ok: false, reason: 'malformed' };

  const expected = createHmac('sha256', signingSecret()).update(payload).digest();
  const provided = fromBase64Url(signature);

  // Constant-time compare; `timingSafeEqual` throws on a length mismatch, so
  // guard that first rather than letting it surface as a 500.
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: 'signature' };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(fromBase64Url(payload).toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const parsed = bookingDraftSchema.safeParse(parsedJson);
  if (!parsed.success) return { ok: false, reason: 'malformed' };

  const age = Math.floor(Date.now() / 1000) - parsed.data.issuedAt;
  if (age > DRAFT_TTL_SECONDS) return { ok: false, reason: 'expired' };

  return { ok: true, draft: parsed.data };
}
