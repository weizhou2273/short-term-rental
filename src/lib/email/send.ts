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
 */
export type Email = { subject: string; text: string; html: string; replyTo?: string; to?: string; fromName?: string };

const DEFAULT_FROM = `${SITE.brand} chat <onboarding@resend.dev>`;

async function resend(path: string, body: object): Promise<Response> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new EmailNotConfiguredError('RESEND_API_KEY is not set');
  return fetch(`https://api.resend.com${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

export async function sendEmail({ subject, text, html, replyTo, to, fromName }: Email): Promise<void> {
  const from = process.env.LEADS_FROM_EMAIL?.trim() || DEFAULT_FROM;
  const res = await resend('/emails', {
    from: fromName ? withDisplayName(from, fromName) : from,
    to: [to || process.env.LEADS_TO_EMAIL?.trim() || SITE.contactEmail],
    subject,
    text,
    html,
    ...(replyTo ? { reply_to: replyTo } : {}),
  });
  if (!res.ok) throw await failure(res);
}

/**
 * Adds an email to the Resend contact list (Resend → Contacts), where it can
 * be exported or sent a broadcast. Needs a "Full access" API key; a
 * "Sending access" key can only send. Someone signing up twice is not an error.
 */
export async function addContact(email: string): Promise<void> {
  const res = await resend('/contacts', { email, unsubscribed: false });
  if (res.ok) return;
  const err = await failure(res);
  if (/already exist/i.test(err.message)) return;
  throw err;
}
