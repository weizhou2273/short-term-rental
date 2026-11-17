import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { type Lead, leadSchema } from './request';

/**
 * A guest's contact details, signed by the server when they fill in the
 * chat's form. The browser keeps the token and sends it with each message,
 * so the chat can't be used without the form, and the transcript email can
 * trust who the guest is without a database.
 *
 * When the guest was added to Go High Level, the token also carries their
 * contact id, so later chat notes go on the right contact without a lookup.
 *
 * The signing key is derived from ANTHROPIC_API_KEY (the chat can't run
 * without it anyway); rotating that key just asks guests for their details again.
 */

const TTL_SECONDS = 90 * 24 * 60 * 60;

function signingKey(): Buffer {
  const secret = process.env.ANTHROPIC_API_KEY;
  if (!secret) throw new Error('ANTHROPIC_API_KEY is not set');
  return createHmac('sha256', secret).update('wk-chat-lead-v1').digest();
}

const sign = (body: string) => createHmac('sha256', signingKey()).update(body).digest('base64url');

export type SignedLead = Lead & { contactId?: string };

const CONTACT_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function signLead(lead: Lead, now = Date.now(), contactId?: string | null): string {
  const cid = contactId && CONTACT_ID.test(contactId) ? { cid: contactId } : {};
  const body = Buffer.from(JSON.stringify({ name: lead.name, email: lead.email, phone: lead.phone, ...cid, iat: Math.floor(now / 1000) })).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** The guest's details (and Go High Level contact id, if known) if the token is genuine and current, else null. */
export function verifyLead(token: string, now = Date.now()): SignedLead | null {
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Lead & { iat?: unknown; cid?: unknown };
    if (typeof payload.iat !== 'number' || now / 1000 - payload.iat > TTL_SECONDS) return null;
    const lead = leadSchema.safeParse(payload);
    if (!lead.success) return null;
    return typeof payload.cid === 'string' && CONTACT_ID.test(payload.cid) ? { ...lead.data, contactId: payload.cid } : lead.data;
  } catch {
    return null;
  }
}
