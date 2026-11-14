import 'server-only';
import type { Lead } from '@/lib/chat/request';
import type { SmsConsent } from '@/lib/chat/shared';

/**
 * Go High Level (HighLevel / LeadConnector API v2): where website leads go
 * (welcome-offer sign-ups and chat sign-ins). Server-only: the token never
 * reaches the browser and is never logged.
 *
 *   GHL_API_TOKEN    a Private Integration token that can View and Edit Contacts
 *   GHL_LOCATION_ID  the sub-account (location) the contacts belong to
 *
 * A lead is "upserted": created, or matched to an existing contact by the
 * location's duplicate-contact setting and updated. Tags sent with an
 * upsert REPLACE a contact's tags, so tags are added in a second call,
 * which only adds.
 *
 * Tags say where the lead came from and which text messages they agreed to
 * (the two optional boxes beside each phone field). Only text contacts who
 * carry the matching consent tag.
 */

const API = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';

/** Where the lead came from. */
export const WELCOME_TAG = 'wkreserve-5-off';
export const CHAT_TAG = 'wkreserve-chat';
export const WELCOME_SOURCE = 'wkreserve.com 5% welcome offer';
export const CHAT_SOURCE = 'wkreserve.com website chat';
export const SIGNUP_TAG = 'wkreserve-text-signup';
export const SIGNUP_SOURCE = 'wkreserve.com text sign-up page';

/** Which texts the lead ticked the box for. No tag means they did not agree on this form. */
export const SMS_TAGS = { nonMarketing: 'sms-consent-non-marketing', marketing: 'sms-consent-marketing' } as const;

export const consentTags = (consent: SmsConsent): string[] => [
  ...(consent.smsNonMarketing ? [SMS_TAGS.nonMarketing] : []),
  ...(consent.smsMarketing ? [SMS_TAGS.marketing] : []),
];

export type CrmConfig = { token: string; locationId: string };

export function crmConfig(): CrmConfig | null {
  const token = process.env.GHL_API_TOKEN?.trim();
  const locationId = process.env.GHL_LOCATION_ID?.trim();
  return token && locationId ? { token, locationId } : null;
}

/** US numbers as +1XXXXXXXXXX; anything already international as +digits; otherwise as typed. */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (phone.trim().startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone.trim();
}

class CrmError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function post<T>(path: string, body: object, { token }: CrmConfig): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Version: VERSION, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string | string[] };
  if (!res.ok) {
    const detail = Array.isArray(data.message) ? data.message.join('; ') : data.message;
    throw new CrmError(res.status, `Go High Level answered ${res.status}${detail ? `: ${String(detail).slice(0, 200)}` : ''}`);
  }
  return data;
}

type Upserted = { new?: boolean; contact?: { id?: string } };

/**
 * Adds (or updates) the guest in Go High Level and adds the tags. Throws if
 * the contact couldn't be saved; tags that couldn't be added are reported
 * in `tagError`, since the contact itself is safe.
 */
export async function addCrmContact(
  lead: Lead,
  { source, tags }: { source: string; tags: string[] },
  config: CrmConfig,
): Promise<{ id: string | null; isNew: boolean | null; tagError: string | null }> {
  const [firstName, ...rest] = lead.name.trim().split(/\s+/);
  const contact = {
    locationId: config.locationId,
    firstName,
    ...(rest.length ? { lastName: rest.join(' ') } : {}),
    name: lead.name.trim(),
    email: lead.email,
    phone: toE164(lead.phone),
  };
  let saved: Upserted;
  try {
    saved = await post<Upserted>('/contacts/upsert', { ...contact, source }, config);
  } catch (err) {
    // A field the account's API version refuses must not cost the lead: try again with the essentials only.
    if (!(err instanceof CrmError) || (err.status !== 400 && err.status !== 422)) throw err;
    saved = await post<Upserted>('/contacts/upsert', contact, config);
  }
  const id = saved.contact?.id ?? null;
  let tagError: string | null = null;
  if (!id) tagError = 'Go High Level didn’t return the contact’s id, so the tags weren’t added';
  else if (tags.length) {
    try {
      await post(`/contacts/${encodeURIComponent(id)}/tags`, { tags }, config);
    } catch (err) {
      tagError = err instanceof Error ? err.message : String(err);
    }
  }
  return { id, isNew: saved.new ?? null, tagError };
}
