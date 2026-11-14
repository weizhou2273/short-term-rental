import 'server-only';
import type { Lead } from '@/lib/chat/request';
import { firstName, type SmsConsent } from '@/lib/chat/shared';
import { crmConfig } from '@/lib/crm/highlevel';
import { SITE } from '@/data/site';
import type { Email } from '@/lib/email/send';
import { SITE_URL } from '@/lib/seo';
import { PROMO_PATTERN } from './promo';

/**
 * The welcome offer: a percentage off the nightly rate of a guest's first
 * direct booking, for joining the list with their name, email and phone. The code is created in
 * Hospitable (Direct → Promo codes; percentage codes apply to the nightly
 * rate, not fees, and this one needs a minimum stay). Its terms are in
 * SITE.welcomeOffer; its name is here, server-only, so it isn't in the
 * page's JavaScript for anyone to find without signing up.
 * WELCOME_PROMO_CODE overrides the name. The popup only shows when Go High
 * Level (GHL_API_TOKEN and GHL_LOCATION_ID) or Resend (RESEND_API_KEY) is
 * set up, so sign-ups always have somewhere to go.
 *
 * Checked live (Nov 10 2026): WELCOME5 gives "Discount (WELCOME5)" of 5% of
 * the nightly subtotal on stays of 2+ nights.
 */

const WELCOME_CODE = 'WELCOME5';

export type WelcomeOffer = { code: string; percent: number; minNights: number };

export function welcomeOffer(): WelcomeOffer | null {
  if (!SITE.welcomeOffer || !(crmConfig() || process.env.RESEND_API_KEY)) return null;
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
export function welcomeEmail(to: string, { code, percent, minNights }: WelcomeOffer, name = ''): Email {
  const host = SITE.hostName;
  const hello = `Hi ${firstName(name) || 'there'},`;
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
    hello,
    `Thanks for joining ${SITE.brand}! Your code is ${code}: ${terms}. ${how}`,
    `${ask}\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
    promise,
    `${host}\n${SITE.brand} · ${SITE_URL} · call or text ${SITE.contactPhone}`,
    optOut,
  ].join('\n\n');
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1c1c1a;max-width:560px">
<p>${esc(hello)}</p>
<p>Thanks for joining ${esc(SITE.brand)}! Your code is <strong style="letter-spacing:.06em">${esc(code)}</strong>: ${esc(terms)}. ${esc(how)}</p>
<p>${esc(ask)}</p>
<ol style="padding-left:20px;margin:0 0 14px">${questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
<p>${esc(promise)}</p>
<p>${esc(host)}<br><span style="color:#666">${esc(SITE.brand)} · <a href="${esc(SITE_URL)}" style="color:#8C6A3A">${esc(SITE.domain)}</a> · call or text ${esc(SITE.contactPhone)}</span></p>
<p style="font-size:12px;color:#888">${esc(optOut)}</p>
</div>`;
  return { to, subject, text, html, replyTo: SITE.contactEmail, fromName: `${host} at ${SITE.brand}` };
}

/** The two text-message boxes as the host reads them: "Texts agreed to: non-marketing yes, marketing no". */
export const consentLine = (c: SmsConsent) => `Texts agreed to: non-marketing ${c.smsNonMarketing ? 'yes' : 'no'}, marketing ${c.smsMarketing ? 'yes' : 'no'}`;

/** The guest's details for an email to the host: plain text, and HTML with one-tap call and text links. */
function detailsFor(lead: Lead, consent?: SmsConsent) {
  const tel = lead.phone.replace(/[^\d+]/g, '');
  const texts = consent ? consentLine(consent) : null;
  return {
    text: `Name: ${lead.name}\nEmail: ${lead.email}\nPhone: ${lead.phone}${texts ? `\n${texts}` : ''}`,
    html: `<p>Name: <strong>${esc(lead.name)}</strong><br>
Email: <a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a><br>
Phone: <a href="tel:${esc(tel)}">${esc(lead.phone)}</a> · <a href="sms:${esc(tel)}">Text</a> · <a href="tel:${esc(tel)}">Call</a>${texts ? `<br>\n${esc(texts)}` : ''}</p>`,
  };
}

/**
 * To the host, for every sign-up handled by email (no Go High Level), so
 * they can follow up while the guest is still looking: name, email and
 * phone, with one-tap call and text links. Reply goes to the guest.
 */
export function signupNoticeEmail(lead: Lead, status: { saved: true } | { saved: false; reason: string }, welcomed: boolean, consent?: SmsConsent): Email {
  const intro = `New welcome-offer sign-up on ${SITE.domain}:`;
  const notes = [
    welcomed
      ? 'They’ve been sent your welcome email with their code and three questions (dates, group size, occasion). Their answers will arrive in this inbox; reply to this email to write to them now.'
      : 'Your welcome email could NOT be sent to them (usually because wkreserve.com isn’t verified in Resend yet). Reply to this email to send them their code and say hello yourself.',
    status.saved ? 'Saved to Resend → Contacts.' : `Not saved to Resend Contacts (${status.reason}). Check that the Resend API key has Full access.`,
  ];
  const details = detailsFor(lead, consent);
  const text = [intro, details.text, ...notes].join('\n\n');
  const html = `<p>${esc(intro)}</p>\n${details.html}\n<p>${notes.map(esc).join('</p><p>')}</p>`;
  return { subject: `New sign-up: ${lead.name}`, text, html, replyTo: lead.email };
}

/**
 * To the host when a lead (a welcome-offer sign-up or a chat sign-in) could
 * not be added to Go High Level, or was added without its tags, so the lead
 * isn't lost: their details and text-message choices, what went wrong and
 * what to check. Reply goes to the guest.
 */
export function crmProblemEmail(
  lead: Lead,
  problem: { saved: boolean; reason: string },
  consent?: SmsConsent,
  what: 'welcome-offer sign-up' | 'website chat lead' = 'welcome-offer sign-up',
): Email {
  const intro = problem.saved
    ? `A ${what} on ${SITE.domain} was added to Go High Level, but without its tags, so an automation that starts from a tag won’t run for them and their text-message choices aren’t recorded there:`
    : `A ${what} on ${SITE.domain} could NOT be added to Go High Level. Please add them by hand:`;
  const notes = [
    `What went wrong: ${problem.reason}`,
    `To fix it, check GHL_API_TOKEN and GHL_LOCATION_ID in Vercel (Settings → Environment Variables), and that the token can View and Edit Contacts.${what === 'welcome-offer sign-up' ? ' The guest was still shown their code.' : ''}`,
  ];
  const details = detailsFor(lead, consent);
  const text = [intro, details.text, ...notes].join('\n\n');
  const html = `<p>${esc(intro)}</p>\n${details.html}\n<p>${notes.map(esc).join('</p><p>')}</p>`;
  const kind = what === 'welcome-offer sign-up' ? 'New sign-up' : 'Website chat';
  return { subject: `${kind}: ${lead.name} (${problem.saved ? 'tags not added in' : 'NOT added to'} Go High Level)`, text, html, replyTo: lead.email };
}
