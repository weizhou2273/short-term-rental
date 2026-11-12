import 'server-only';
import { SITE } from '@/data/site';

/**
 * Email through Resend (resend.com): notifications to the host, the welcome
 * offer's code to a guest, and the welcome offer's contact list.
 *
 *   RESEND_API_KEY     required; without it nothing is sent
 *   LEADS_TO_EMAIL     where to send; defaults to the site's contact email
 *   LEADS_FROM_EMAIL   sender; defaults to Resend's test sender, which can only
 *                      deliver to the email address of the Resend account itself,
 *                      so emails to guests need a verified domain.
 *                      After verifying wkreserve.com in Resend, set e.g.
 *                      "W&K Reserve <chat@wkreserve.com>".
 */

export class EmailNotConfiguredError extends Error {}

/**
 * `to` defaults to the host (LEADS_TO_EMAIL, else the site's contact email).
 * `fromName` replaces the sender's display name, keeping its address.
 * `bccHost` sends the host a blind copy (of an email to a guest).
 */
export type Email = { subject: string; text: string; html: string; replyTo?: string; to?: string; fromName?: string; bccHost?: boolean };

/**
 * Whether email can reach guests: Resend's test sender (the default) only
 * delivers to the account's own address, so guests need a sender on the
 * verified wkreserve.com domain.
 */
export const canEmailGuests = () => !(process.env.LEADS_FROM_EMAIL?.trim() || DEFAULT_FROM).includes('@resend.dev');

const hostAddress = () => process.env.LEADS_TO_EMAIL?.trim() || SITE.contactEmail;

const DEFAULT_FROM = `${SITE.brand} chat <onboarding@resend.dev>`;

async function resend(path: string, body?: object): Promise<Response> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new EmailNotConfiguredError('RESEND_API_KEY is not set');
  return fetch(`https://api.resend.com${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10_000),
  });
}

async function failure(res: Response): Promise<Error> {
  const detail = await res.text().catch(() => '');
  return new Error(`Resend answered ${res.status}: ${detail.slice(0, 300)}`);
}

/** "Name <address>" with the display name swapped; quotes keep "&" and commas safe. */
export function withDisplayName(from: string, name: string): string {
  const address = from.match(/<([^>]+)>/)?.[1] ?? from.trim();
  return `"${name.replace(/["\\]/g, '')}" <${address}>`;
}

export async function sendEmail({ subject, text, html, replyTo, to, fromName, bccHost }: Email): Promise<void> {
  const from = process.env.LEADS_FROM_EMAIL?.trim() || DEFAULT_FROM;
  const res = await resend('/emails', {
    from: fromName ? withDisplayName(from, fromName) : from,
    to: [to || hostAddress()],
    ...(bccHost && to ? { bcc: [hostAddress()] } : {}),
    subject,
    text,
    html,
    ...(replyTo ? { reply_to: replyTo } : {}),
  });
  if (!res.ok) throw await failure(res);
}

/**
 * Adds an email, with the guest's name if known, to the Resend contact list
 * (Resend → Contacts), where it can be exported or sent a broadcast. Needs a "Full access" API key; a
 * "Sending access" key can only send. Someone signing up twice is not an error.
 */
export async function addContact(email: string, name = ''): Promise<void> {
  const [first, ...rest] = name.trim().split(/\s+/).filter(Boolean);
  const res = await resend('/contacts', {
    email,
    unsubscribed: false,
    ...(first ? { first_name: first } : {}),
    ...(rest.length ? { last_name: rest.join(' ') } : {}),
  });
  if (res.ok) return;
  const err = await failure(res);
  if (/already exist/i.test(err.message)) return;
  throw err;
}

/**
 * Whether an email to `to` whose subject starts with `subjectPrefix` was sent
 * in the last `withinMs` (from Resend's list of recent emails), so a guest
 * isn't sent the same follow-up twice. Needs a "Full access" key; with any
 * error it says "no", so a follow-up is never lost to a lookup failure.
 */
export async function sentRecently(to: string, subjectPrefix: string, withinMs = 24 * 60 * 60 * 1000, now = Date.now()): Promise<boolean> {
  try {
    const res = await resend('/emails?limit=100');
    if (!res.ok) return false;
    const { data } = (await res.json()) as { data?: { to?: string[]; subject?: string; created_at?: string }[] };
    const target = to.toLowerCase();
    return (data ?? []).some((e) => {
      // Resend writes times like "2026-11-11 02:19:14.478000+00".
      const at = Date.parse(`${(e.created_at ?? '').slice(0, 19).replace(' ', 'T')}Z`);
      return (
        (e.to ?? []).some((t) => t.toLowerCase() === target) &&
        (e.subject ?? '').startsWith(subjectPrefix) &&
        Number.isFinite(at) &&
        now - at < withinMs
      );
    });
  } catch {
    return false;
  }
}
