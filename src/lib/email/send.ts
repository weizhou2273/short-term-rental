import 'server-only';
import { SITE } from '@/data/site';

/**
 * Sends a notification email to the host through Resend (resend.com).
 *
 *   RESEND_API_KEY     required; without it nothing is sent
 *   LEADS_TO_EMAIL     where to send; defaults to the site's contact email
 *   LEADS_FROM_EMAIL   sender; defaults to Resend's test sender, which can only
 *                      deliver to the email address of the Resend account itself.
 *                      After verifying wkreserve.com in Resend, set e.g.
 *                      "W&K Reserve <chat@wkreserve.com>".
 */

export class EmailNotConfiguredError extends Error {}

export type Email = { subject: string; text: string; html: string; replyTo?: string };

const DEFAULT_FROM = `${SITE.brand} chat <onboarding@resend.dev>`;

export async function sendEmail({ subject, text, html, replyTo }: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new EmailNotConfiguredError('RESEND_API_KEY is not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.LEADS_FROM_EMAIL?.trim() || DEFAULT_FROM,
      to: [process.env.LEADS_TO_EMAIL?.trim() || SITE.contactEmail],
      subject,
      text,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend answered ${res.status}: ${detail.slice(0, 300)}`);
  }
}
