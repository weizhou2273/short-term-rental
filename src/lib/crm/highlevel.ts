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

// GHL_API_BASE points the site at a stand-in Go High Level for local testing; unset in production.
const API = (process.env.GHL_API_BASE?.trim() || 'https://services.leadconnectorhq.com').replace(/\/$/, '');
const VERSION = '2021-07-28';

/** Where the lead came from. */
export const WELCOME_TAG = 'wkreserve-5-off';
export const CHAT_TAG = 'wkreserve-chat';
export const WELCOME_SOURCE = 'wkreserve.com 5% welcome offer';
export const CHAT_SOURCE = 'wkreserve.com website chat';
export const SIGNUP_TAG = 'wkreserve-text-signup';
export const SIGNUP_SOURCE = 'wkreserve.com text sign-up page';
/** Added when a chat's transcript note is first written, for a Go High Level workflow (e.g. a task for the team) to start from. */
export const TRANSCRIPT_TAG = 'chat-transcript';

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

/**
 * One call to the API. The token goes only in the Authorization header and
 * never into an error message or log line.
 */
async function call<T>(method: 'GET' | 'POST' | 'PUT', path: string, body: object | null, { token }: CrmConfig): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: VERSION,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(8_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string | string[] };
  if (!res.ok) {
    const detail = Array.isArray(data.message) ? data.message.join('; ') : data.message;
    throw new CrmError(res.status, `Go High Level answered ${res.status}${detail ? `: ${String(detail).slice(0, 200)}` : ''}`);
  }
  return data;
}

const post = <T>(path: string, body: object, config: CrmConfig) => call<T>('POST', path, body, config);

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

/**
 * The contact for a guest, found by email (then phone) with the location's
 * duplicate check, for chats whose sign-in token predates the contact id.
 * null if there's no such contact.
 */
export async function findContactId(lead: Lead, config: CrmConfig): Promise<string | null> {
  type Found = { contact?: { id?: string } | null };
  const base = `/contacts/search/duplicate?locationId=${encodeURIComponent(config.locationId)}`;
  const byEmail = await call<Found>('GET', `${base}&email=${encodeURIComponent(lead.email)}`, null, config);
  if (byEmail.contact?.id) return byEmail.contact.id;
  const byPhone = await call<Found>('GET', `${base}&number=${encodeURIComponent(toE164(lead.phone))}`, null, config);
  return byPhone.contact?.id ?? null;
}

type Note = { id: string; body?: string };

/**
 * Writes one chat's transcript note on a contact: creates it the first time
 * (and then adds the TRANSCRIPT_TAG), afterwards rewrites the same note. The
 * note is found again by the "Chat ref" line that `build` puts in it, so the
 * server needs no storage of its own. `build` gets the note's current text
 * (null when there is none yet) and returns the text it should have.
 * Throws if the note couldn't be written; a tag that couldn't be added is
 * reported in `tagError`.
 */
export async function writeChatNote(
  contactId: string,
  ref: string,
  build: (current: string | null) => string,
  config: CrmConfig,
): Promise<{ noteId: string | null; created: boolean; tagError: string | null }> {
  const path = `/contacts/${encodeURIComponent(contactId)}/notes`;
  const { notes = [] } = await call<{ notes?: Note[] }>('GET', path, null, config);
  const existing = notes.find((n) => n.body?.includes(chatRefLine(ref)));
  if (existing) {
    const body = build(existing.body ?? '');
    if (body !== existing.body) await call('PUT', `${path}/${encodeURIComponent(existing.id)}`, { body }, config);
    return { noteId: existing.id, created: false, tagError: null };
  }
  const created = await post<{ note?: Note }>(path, { body: build(null) }, config);
  let tagError: string | null = null;
  try {
    await post(`/contacts/${encodeURIComponent(contactId)}/tags`, { tags: [TRANSCRIPT_TAG] }, config);
  } catch (err) {
    tagError = err instanceof Error ? err.message : String(err);
  }
  return { noteId: created.note?.id ?? null, created: true, tagError };
}

/** The line that ties a note to one chat, so later updates find it. */
export const chatRefLine = (ref: string) => `Chat ref: ${ref}`;
