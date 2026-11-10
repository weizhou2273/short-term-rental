import 'server-only';
import { SITE } from '@/data/site';
import type { Email } from '@/lib/email/send';
import { SITE_URL } from '@/lib/seo';
import { PROMO_PATTERN } from './promo';

/**
 * The welcome offer: a percentage off a guest's first direct booking, for
 * joining the email list. The code itself is created in Hospitable (Direct →
 * promo codes) and named here with WELCOME_PROMO_CODE; the popup only shows
 * when that and RESEND_API_KEY are set, so it can't promise a code that
 * doesn't exist.
 */

export type WelcomeOffer = { code: string; percent: number };

export function welcomeOffer(): WelcomeOffer | null {
  const code = process.env.WELCOME_PROMO_CODE?.trim();
  if (!code || !PROMO_PATTERN.test(code) || !process.env.RESEND_API_KEY) return null;
  return { code, percent: SITE.welcomeOfferPercent };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function welcomeEmail(to: string, { code, percent }: WelcomeOffer): Email {
  const subject = `Your ${percent}% off code for ${SITE.brand}`;
  const homes = `${SITE_URL}/search`;
  const how = `On the device you signed up with, it’s applied automatically when you check prices. Anywhere else, enter it under “Have a promo code?” on any home’s page.`;
  const text = [
    `Thanks for joining ${SITE.brand}!`,
    `Your code: ${code}`,
    `${percent}% off your first stay booked directly at ${SITE.domain}. ${how}`,
    `Browse our homes: ${homes}`,
    `Questions? Call or text ${SITE.contactPhone}, or reply to this email.`,
    `You’re getting this email because you signed up at ${SITE.domain}.`,
  ].join('\n\n');
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c1c1a;max-width:520px">
<p>Thanks for joining ${esc(SITE.brand)}!</p>
<p style="margin:20px 0;padding:16px;border:1px dashed #B08D57;border-radius:8px;text-align:center"><span style="display:block;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#8C6A3A">Your code</span><strong style="font-size:24px;letter-spacing:.08em">${esc(code)}</strong><span style="display:block;margin-top:4px">${percent}% off your first direct stay</span></p>
<p>${esc(how)}</p>
<p><a href="${esc(homes)}" style="display:inline-block;padding:10px 18px;background:#1F3A2E;color:#F4EFE6;text-decoration:none;border-radius:2px">Browse our homes</a></p>
<p>Questions? Call or text ${esc(SITE.contactPhone)}, or reply to this email.</p>
<p style="font-size:12px;color:#777">You’re getting this email because you signed up at ${esc(SITE.domain)}.</p>
</div>`;
  return { to, subject, text, html, replyTo: SITE.contactEmail };
}
