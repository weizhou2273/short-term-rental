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

export function welcomeEmail(to: string, { code, percent, minNights }: WelcomeOffer): Email {
  const terms = `${percent}% off the nightly rate of your first direct stay${minStayText(minNights)}`;
  const subject = `Your ${percent}% off code for ${SITE.brand}`;
  const homes = `${SITE_URL}/search`;
  const how = `On the device you signed up with, it’s applied automatically when you check prices. Anywhere else, enter it under “Have a promo code?” on any home’s page.`;
  const text = [
    `Thanks for joining ${SITE.brand}!`,
    `Your code: ${code}`,
    `${terms}, booked at ${SITE.domain}. ${how}`,
    `Browse our homes: ${homes}`,
    `Questions? Call or text ${SITE.contactPhone}, or reply to this email.`,
    `You’re getting this email because you signed up at ${SITE.domain}.`,
  ].join('\n\n');
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c1c1a;max-width:520px">
<p>Thanks for joining ${esc(SITE.brand)}!</p>
<p style="margin:20px 0;padding:16px;border:1px dashed #B08D57;border-radius:8px;text-align:center"><span style="display:block;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#8C6A3A">Your code</span><strong style="font-size:24px;letter-spacing:.08em">${esc(code)}</strong><span style="display:block;margin-top:4px">${esc(terms)}</span></p>
<p>${esc(how)}</p>
<p><a href="${esc(homes)}" style="display:inline-block;padding:10px 18px;background:#1F3A2E;color:#F4EFE6;text-decoration:none;border-radius:2px">Browse our homes</a></p>
<p>Questions? Call or text ${esc(SITE.contactPhone)}, or reply to this email.</p>
<p style="font-size:12px;color:#777">You’re getting this email because you signed up at ${esc(SITE.domain)}.</p>
</div>`;
  return { to, subject, text, html, replyTo: SITE.contactEmail };
}

/** To the host, only when an address couldn't be saved to Resend Contacts, so no sign-up is lost. */
export function signupNoticeEmail(email: string, reason: string): Email {
  const text = `New welcome-offer sign-up on ${SITE.domain}: ${email}\n\nIt couldn’t be added to Resend Contacts (${reason}), so it’s sent here instead. Check that the Resend API key has Full access.`;
  return { subject: `New email sign-up: ${email}`, text, html: `<p>${esc(text).replace(/\n/g, '<br>')}</p>`, replyTo: email };
}
