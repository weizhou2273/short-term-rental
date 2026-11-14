import { SITE } from '@/data/site';
import { PROPERTY_TIME_ZONE } from '@/lib/dates';
import { SITE_URL } from '@/lib/seo';
import type { Email } from '@/lib/email/send';
import type { Lead } from './request';
import { firstName, type SmsConsent } from './shared';

/**
 * The host's emails about a chat: one when a guest leaves their details, then
 * the conversation when they close the chat or leave the page. Both use the
 * same subject, so mail apps keep them in one thread, and Reply goes to the guest.
 */

type Turn = { role: 'user' | 'assistant'; content: string };
type Context = { page?: string; at?: Date; consent?: SmsConsent };

const texts = (c: SmsConsent) => `non-marketing ${c.smsNonMarketing ? 'yes' : 'no'}, marketing ${c.smsMarketing ? 'yes' : 'no'}`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const subject = (lead: Lead) => `Website chat: ${lead.name}`;

const when = (at: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: PROPERTY_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(at) + ' ET';

function contact(lead: Lead, { page, at = new Date(), consent }: Context) {
  const tel = lead.phone.replace(/[^\d+]/g, '');
  const url = page ? `${SITE_URL}${page}` : null;
  const text = [
    `Name: ${lead.name}`,
    `Phone: ${lead.phone}`,
    `Email: ${lead.email}`,
    consent ? `Texts agreed to: ${texts(consent)}` : null,
    url ? `Page: ${url}` : null,
    `Time: ${when(at)}`,
  ]
    .filter(Boolean)
    .join('\n');
  const row = (label: string, value: string) => `<tr><td style="padding:2px 12px 2px 0;color:#666">${label}</td><td>${value}</td></tr>`;
  const html = `<table style="border-collapse:collapse">${[
    row('Name', esc(lead.name)),
    row('Phone', `<a href="tel:${esc(tel)}">${esc(lead.phone)}</a>`),
    row('Email', `<a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a>`),
    consent ? row('Texts agreed to', esc(texts(consent))) : '',
    url ? row('Page', `<a href="${esc(url)}">${esc(page!)}</a>`) : '',
    row('Time', esc(when(at))),
  ].join('')}</table>`;
  return { text, html };
}

const wrap = (body: string) => `<div style="font-family:system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1c1c1a">${body}</div>`;

/** Whether the lead came from the form on /text-signup, not from the chat. */
export const isSignupPage = (page?: string) => Boolean(page && /^\/text-signup(?:[/?#]|$)/.test(page));

export function leadEmail(lead: Lead, ctx: Context = {}): Email {
  const c = contact(lead, ctx);
  const signup = isSignupPage(ctx.page);
  const intro = signup ? `${lead.name} left their details on ${SITE.domain}/text-signup.` : `${lead.name} started a chat on ${SITE.domain}.`;
  const outro = `Reply to this email to write to ${firstName(lead.name)}.${signup ? '' : ' Their conversation follows when they close the chat or leave the site.'}`;
  return {
    subject: subject(lead),
    replyTo: lead.email,
    text: `${intro}\n\n${c.text}\n\n${outro}`,
    html: wrap(`<p>${esc(intro)}</p>${c.html}<p style="color:#666">${esc(outro)}</p>`),
  };
}

export function transcriptEmail(lead: Lead, messages: Turn[], ctx: Context = {}): Email {
  const c = contact(lead, ctx);
  const who = (t: Turn) => (t.role === 'user' ? firstName(lead.name) || 'Guest' : 'Concierge (AI)');
  const intro = `Conversation with ${lead.name} on ${SITE.domain}:`;
  const lines = messages.map((t) => `${who(t)}:\n${t.content}`).join('\n\n');
  const bubbles = messages
    .map(
      (t) =>
        `<div style="margin:0 0 12px"><div style="font-weight:600;color:${t.role === 'user' ? '#1F3A2E' : '#8C6A3A'}">${esc(who(t))}</div><div style="white-space:pre-wrap">${esc(t.content)}</div></div>`,
    )
    .join('');
  return {
    subject: subject(lead),
    replyTo: lead.email,
    text: `${intro}\n\n${lines}\n\n---\n${c.text}`,
    html: wrap(`<p>${esc(intro)}</p>${bubbles}<hr style="border:none;border-top:1px solid #ddd">${c.html}`),
  };
}
