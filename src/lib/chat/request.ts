import { z } from 'zod';
import { CHAT_LIMITS, isPhone, LEAD_LIMITS, NAME_PATTERN, TRANSCRIPT_LIMITS } from './shared';

export { CHAT_LIMITS, type ChatEvent } from './shared';

/** Request bodies for the chat routes. */

const turn = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1, 'Type a message.'),
});

const alternating = (ms: { role: string }[]) => ms.every((m, i) => m.role === (i % 2 === 0 ? 'user' : 'assistant'));
const totalChars = (ms: { content: string }[]) => ms.reduce((n, m) => n + m.content.length, 0);
const guestMessagesFit = (ms: { role: string; content: string }[]) =>
  ms.every((m) => m.role === 'assistant' || m.content.length <= CHAT_LIMITS.messageChars);

/** A signed token from /api/chat/lead; checked by the route. */
const leadToken = z.string().min(1).max(2000);

/** A path on this site, e.g. "/stays/minsi-pond?checkin=…". */
const page = z
  .string()
  .max(500)
  .regex(/^\/(?!\/)/)
  .optional()
  .catch(undefined);

export const chatRequestSchema = z.object({
  lead: leadToken,
  messages: z
    .array(turn)
    .min(1, 'Type a message.')
    .max(CHAT_LIMITS.messages, 'This chat is getting long. Please start a new one.')
    .refine(alternating, 'Messages must alternate, starting with the guest.')
    .refine((ms) => ms.at(-1)?.role === 'user', 'The last message must be the guest’s.')
    .refine(guestMessagesFit, 'That message is too long.')
    .refine((ms) => totalChars(ms) <= CHAT_LIMITS.totalChars, 'This chat is getting long. Please start a new one.'),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const leadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please enter your name.')
    .max(LEAD_LIMITS.name, 'Please shorten your name.')
    .regex(NAME_PATTERN, 'Please enter your name using letters only.'),
  email: z.string().trim().max(LEAD_LIMITS.email).pipe(z.email('Please enter a valid email address.')),
  phone: z.string().trim().max(LEAD_LIMITS.phone).refine(isPhone, 'Please enter a phone number we can call or text, with area code.'),
});

export type Lead = z.infer<typeof leadSchema>;

/** The two optional text-message boxes; a form that doesn't send them means "no". */
const smsConsent = { smsNonMarketing: z.boolean().default(false), smsMarketing: z.boolean().default(false) };

/** The chat's sign-in: the guest's details, their text-message choices and the page they were on. */
export const leadRequestSchema = leadSchema.extend({ page, ...smsConsent });

/** The welcome offer's sign-up: the guest's details and their text-message choices. */
export const signupRequestSchema = leadSchema.extend(smsConsent);

/** A finished conversation to email to the host: like a chat request, but it may end on either side. */
export const transcriptRequestSchema = z.object({
  lead: leadToken,
  page,
  messages: z
    .array(turn)
    .min(1)
    .max(TRANSCRIPT_LIMITS.messages)
    .refine(alternating)
    .refine(guestMessagesFit)
    .refine((ms) => totalChars(ms) <= TRANSCRIPT_LIMITS.totalChars),
});
