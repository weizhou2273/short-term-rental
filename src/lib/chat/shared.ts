/**
 * Chat constants and types used by both the browser widget and the API
 * routes. No dependencies, so the widget's bundle stays small.
 */

/** Limits on what the browser may send. The API routes enforce the same limits. */
export const CHAT_LIMITS = {
  /** Characters in one guest message. */
  messageChars: 1000,
  /** Messages sent per request (the conversation so far plus the new one). */
  messages: 20,
  /** Characters across the whole conversation. */
  totalChars: 16_000,
};

/** The conversation emailed to the host (the widget trims the oldest messages to fit). */
export const TRANSCRIPT_LIMITS = { messages: 40, totalChars: 30_000 };

export const LEAD_LIMITS = { name: 80, email: 254, phone: 30 };

/** A name is letters, spaces and ' - . only (it is also shown to the model). */
export const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} '’.-]*$/u;

/** 10–15 digits, written with any of + ( ) - . and spaces. */
export function isPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '').length;
  return /^[\d\s()+.-]+$/.test(value) && digits >= 10 && digits <= 15;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

/** localStorage key for the guest's name, email and phone, so the chat and the welcome offer don't ask twice. */
export const GUEST_KEY = 'wk-chat-guest-v1';

/** Newline-delimited JSON events sent to the browser by /api/chat. */
export type ChatEvent =
  /** A model call starts. A later `reset` drops the text sent since this point. */
  | { type: 'turn' }
  | { type: 'text'; text: string }
  | { type: 'status'; text: string }
  | { type: 'reset' }
  | { type: 'done' }
  | { type: 'error'; message: string };
