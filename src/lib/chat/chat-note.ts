import 'server-only';
import { randomUUID } from 'node:crypto';
import { addCrmContact, CHAT_SOURCE, CHAT_TAG, chatRefLine, type CrmConfig, crmConfig, findContactId, writeChatNote } from '@/lib/crm/highlevel';
import { SITE_URL } from '@/lib/seo';
import { when } from './lead-email';
import type { Lead } from './request';
import type { SmsConsent } from './shared';

/**
 * Each website chat as one note on the guest's Go High Level contact, so the
 * team sees what leads asked without the email:
 *
 *   Website chat transcript – Nov 13, 2026, 10:52 PM ET – page: /stays/minsi-pond
 *
 *   Visitor: …
 *
 *   Concierge: …
 *
 *   —
 *   Texts agreed to in this chat: non-marketing no, marketing no
 *   Chat ref: 3f2c…
 *
 * The note is written by the server, not the browser: when the guest fills
 * in the chat's form ("Started chat, no messages."), after every reply, and
 * once more when they close the chat or leave. So it's complete up to the
 * last reply even if the browser never says the chat ended. The "Chat ref"
 * (an id the browser makes for each conversation) finds the same note
 * again; the first write also adds the "chat-transcript" tag.
 *
 * Go High Level is separate from the email backup: either can fail without
 * stopping the other, and failures are logged (never the token).
 */

type Turn = { role: 'user' | 'assistant'; content: string };

export const NO_MESSAGES = 'Started chat, no messages.';
const FOOTER = '\n\n—\n';
const CONSENT_PREFIX = 'Texts agreed to in this chat:';
/** Notes stay well inside what Go High Level shows comfortably; the oldest messages go first. */
const MAX_CONVERSATION = 40_000;

export const noteHeader = (at: Date, page?: string) => `Website chat transcript – ${when(at)} – page: ${page ? page.split(/[?#]/)[0] || '/' : 'unknown'}`;

const consentText = (c: SmsConsent) => `${CONSENT_PREFIX} non-marketing ${c.smsNonMarketing ? 'yes' : 'no'}, marketing ${c.smsMarketing ? 'yes' : 'no'}`;

/** Chat replies use markdown links and bold; the note shows the plain text with full links. */
const plain = (text: string) =>
  text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => `${label} (${href.startsWith('/') ? SITE_URL + href : href})`).replace(/\*\*([^*]+)\*\*/g, '$1');

const render = (messages: Turn[]) => messages.map((t) => `${t.role === 'user' ? 'Visitor' : 'Concierge'}: ${plain(t.content.trim())}`).join('\n\n');

/**
 * Puts what's already in the note together with the conversation the browser
 * sent now. The browser drops the oldest messages from long chats, so the
 * new text may start partway through the old; nothing already saved is lost.
 */
function merge(saved: string, next: string): string {
  if (!saved || saved === NO_MESSAGES) return next;
  if (!next) return saved;
  if (next.startsWith(saved)) return next;
  // Find where `next` picks up inside `saved`, at the start of one of the visitor's messages.
  for (let i = saved.indexOf('\n\nVisitor: '); i !== -1; i = saved.indexOf('\n\nVisitor: ', i + 1)) {
    if (next.startsWith(saved.slice(i + 2))) return saved.slice(0, i + 2) + next;
  }
  // Nothing in common (shouldn't happen): keep both rather than lose anything.
  return saved.includes(next) ? saved : `${saved}\n\n${next}`;
}

/** The note's full text, from its current text (null if new) and the conversation so far. */
export function chatNoteBody(
  current: string | null,
  { header, messages, consent, ref }: { header: string; messages: Turn[]; consent?: SmsConsent; ref: string },
): string {
  const [head, ...rest] = (current ?? '').split('\n');
  const savedHeader = current ? head : null;
  const afterHeader = current ? rest.join('\n').replace(/^\n/, '') : '';
  const footerAt = afterHeader.lastIndexOf(FOOTER);
  const savedConversation = footerAt === -1 ? afterHeader : afterHeader.slice(0, footerAt);
  const savedConsent = afterHeader.split('\n').find((l) => l.startsWith(CONSENT_PREFIX)) ?? null;

  let conversation = merge(savedConversation.trim(), render(messages)) || NO_MESSAGES;
  if (conversation.length > MAX_CONVERSATION) conversation = `(earlier messages trimmed)\n\n${conversation.slice(-MAX_CONVERSATION)}`;
  const footer = [consent ? consentText(consent) : savedConsent, chatRefLine(ref)].filter(Boolean).join('\n');
  return `${savedHeader ?? header}\n\n${conversation}${FOOTER}${footer}`;
}

/** The guest's contact id: from their sign-in token, else found by email or phone, else added now. */
async function contactIdFor(lead: Lead & { contactId?: string }, config: CrmConfig): Promise<string | null> {
  if (lead.contactId) return lead.contactId;
  const found = await findContactId(lead, config);
  if (found) return found;
  // Signed in before chat leads went to Go High Level. No text-message tags: we don't know their choice.
  const added = await addCrmContact(lead, { source: CHAT_SOURCE, tags: [CHAT_TAG] }, config);
  return added.id;
}

/**
 * Saves the chat so far as the guest's transcript note in Go High Level.
 * Does nothing without Go High Level set up. Never throws: problems are
 * logged and returned, so callers can carry on with the email.
 */
export async function saveChatNote({
  lead,
  chatId,
  page,
  messages,
  consent,
  at = new Date(),
}: {
  lead: Lead & { contactId?: string };
  /** The browser's id for this conversation; without one (an old page) a new note is made. */
  chatId?: string;
  page?: string;
  messages: Turn[];
  /** Only from the chat's form, where the guest chose; later saves keep what the note already says. */
  consent?: SmsConsent;
  at?: Date;
}): Promise<{ ok: boolean; created?: boolean; error?: string }> {
  const config = crmConfig();
  if (!config) return { ok: true };
  try {
    const contactId = await contactIdFor(lead, config);
    if (!contactId) throw new Error('Go High Level didn’t return a contact id');
    const ref = chatId ?? randomUUID();
    const result = await writeChatNote(contactId, ref, (current) => chatNoteBody(current, { header: noteHeader(at, page), messages, consent, ref }), config);
    if (result.tagError) console.error('[chat] Go High Level: chat-transcript tag not added:', result.tagError);
    return { ok: true, created: result.created };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[chat] Go High Level: transcript note not saved:', error);
    return { ok: false, error };
  }
}
