import { z } from 'zod';

/** Limits on what the browser may send to /api/chat. The widget enforces the same limits. */
export const CHAT_LIMITS = {
  /** Characters in one guest message. */
  messageChars: 1000,
  /** Messages sent per request (the conversation so far plus the new one). */
  messages: 20,
  /** Characters across the whole conversation. */
  totalChars: 16_000,
};

const turn = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1, 'Type a message.'),
});

export const chatRequestSchema = z.object({
  messages: z
    .array(turn)
    .min(1, 'Type a message.')
    .max(CHAT_LIMITS.messages, 'This chat is getting long. Please start a new one.')
    .refine((ms) => ms.every((m, i) => m.role === (i % 2 === 0 ? 'user' : 'assistant')), 'Messages must alternate, starting with the guest.')
    .refine((ms) => ms.at(-1)?.role === 'user', 'The last message must be the guest’s.')
    .refine((ms) => ms.every((m) => m.role === 'assistant' || m.content.length <= CHAT_LIMITS.messageChars), 'That message is too long.')
    .refine((ms) => ms.reduce((n, m) => n + m.content.length, 0) <= CHAT_LIMITS.totalChars, 'This chat is getting long. Please start a new one.'),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Newline-delimited JSON events sent to the browser. */
export type ChatEvent =
  /** A model call starts. A later `reset` drops the text sent since this point. */
  | { type: 'turn' }
  | { type: 'text'; text: string }
  | { type: 'status'; text: string }
  | { type: 'reset' }
  | { type: 'done' }
  | { type: 'error'; message: string };
