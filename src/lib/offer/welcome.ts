import 'server-only';
import { SITE } from '@/data/site';
import type { Email } from '@/lib/email/send';
import { SITE_URL } from '@/lib/seo';
import { PROMO_PATTERN } from './promo';

/**
 * The welcome offer: a percentage off the nightly rate of a guest's first
 * direct booking, for joining the email list. The code is created in
 * Hospitable (Direct → Promo codes; percentage codes apply to the nightly
 * rate, not fees, and this one needs a minimum stay). Its terms are in
 * SITE.welcomeOffer; its name is here, server-only, so it isn't in the
 * page's JavaScript for anyone to find without signing up.
 * WELCOME_PROMO_CODE overrides the name. The popup only shows with
 * RESEND_API_KEY set, so sign-ups always have somewhere to go.
 *
 * Checked live (Nov 10 2026): WELCOME5 gives "Discount (WELCOME5)" of 5% of
 * the nightly subtotal on stays of 2+ nights.
 */

const WELCOME_CODE = 'WELCOME5';

export type WelcomeOffer = { code: string; percent: number; minNights: number };

export function welcomeOffer(): WelcomeOffer | null {
  if (!SITE.welcomeOffer || !process.env.RESEND_API_KEY) return null;
  const code = process.env.WELCOME_PROMO_CODE?.trim() || WELCOME_CODE;
  if (!PROMO_PATTERN.test(code)) return null;
  return { code, ...SITE.welcomeOffer };
}

/** " of 2 nights or more", or nothing for a 1-night minimum. */
export const minStayText = (minNights: number) => (minNights > 1 ? ` of ${minNights} nights or more` : '');

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Sent the moment a guest signs up: their code, then three easy questions
 * from the host, so the reply starts a conversation. Plain and personal on
 * purpose (people answer a note from a person, not a promo); replies go to
 * the host's inbox.
 */
export function welcomeEmail(to: string, { code, percent, minNights }: WelcomeOffer): Email {
  const host = SITE.hostName;
  const terms = `${percent}% off the nightly rate of your first direct stay${minStayText(minNights)}`;
  const subject = `Your ${percent}% code, and a quick question`;
  const how = `It’s applied automatically on the device you signed up with. Anywhere else, enter it under “Have a promo code?” on any home’s page at ${SITE.domain}.`;
  const questions = [
    'Roughly when are you thinking of coming?',
    'How many people, and any kids or dogs?',
    'What’s the occasion: family get-together, friends’ trip, skiing, a celebration?',
  ];
  const ask = 'I’d love to help you find the right home. Just hit reply and tell me:';
  const promise = 'I’ll write back personally with the homes that fit and what’s open.';
  const optOut = `You’re getting this because you signed up at ${SITE.domain}. Not interested? Reply “unsubscribe” and we won’t email you again.`;
  const text = [
    'Hi there,',
    `Thanks for joining ${SITE.brand}! Your code is ${code}: ${terms}. ${how}`,
    `${ask}\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
    promise,
    `${host}\n${SITE.brand} · ${SITE_URL} · call or text ${SITE.contactPhone}`,
    optOut,
  ].join('\n\n');
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1c1c1a;max-width:560px">
<p>Hi there,</p>
<p>Thanks for joining ${esc(SITE.brand)}! Your code is <strong style="letter-spacing:.06em">${esc(code)}</strong>: ${esc(terms)}. ${esc(how)}</p>
<p>${esc(ask)}</p>
<ol style="padding-left:20px;margin:0 0 14px">${questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
<p>${esc(promise)}</p>
<p>${esc(host)}<br><span style="color:#666">${esc(SITE.brand)} · <a href="${esc(SITE_URL)}" style="color:#8C6A3A">${esc(SITE.domain)}</a> · call or text ${esc(SITE.contactPhone)}</span></p>
<p style="font-size:12px;color:#888">${esc(optOut)}</p>
</div>`;
  return { to, subject, text, html, replyTo: SITE.contactEmail, fromName: `${host} at ${SITE.brand}` };
}

/** To the host, for every sign-up, so they can follow up; Reply goes to the guest. */
export function signupNoticeEmail(email: string, status: { saved: true } | { saved: false; reason: string }, welcomed: boolean): Email {
  const lines = [
    `New welcome-offer sign-up on ${SITE.domain}: ${email}`,
    welcomed
      ? 'They’ve been sent your welcome email with their code and three questions (dates, group size, occasion). Their answers will arrive in this inbox; reply to this email to write to them now.'
      : 'Your welcome email could NOT be sent to them (usually because wkreserve.com isn’t verified in Resend yet). Reply to this email to send them their code and say hello yourself.',
    status.saved ? 'Saved to Resend → Contacts.' : `Not saved to Resend Contacts (${status.reason}). Check that the Resend API key has Full access.`,
  ];
  const text = lines.join('\n\n');
  return { subject: `New sign-up: ${email}`, text, html: `<p>${lines.map(esc).join('</p><p>')}</p>`, replyTo: email };
}
