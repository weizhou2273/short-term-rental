import type { NextRequest } from 'next/server';
import { errorResponse, isSameOrigin, json, readJson } from '@/lib/api';
import { signLead } from '@/lib/chat/lead';
import { isSignupPage, leadEmail } from '@/lib/chat/lead-email';
import { leadRequestSchema } from '@/lib/chat/request';
import { firstName } from '@/lib/chat/shared';
import { addCrmContact, CHAT_SOURCE, CHAT_TAG, consentTags, crmConfig, SIGNUP_SOURCE, SIGNUP_TAG } from '@/lib/crm/highlevel';
import { sendEmail } from '@/lib/email/send';
import { crmProblemEmail } from '@/lib/offer/welcome';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';

/**
 * POST /api/chat/lead  { name, email, phone, smsNonMarketing?, smsMarketing?, page? }
 *   → 200 { token, firstName }  and an email to the host with the details.
 *
 * The chat asks for these before the first question, and /text-signup has
 * the same form in its page body. The token goes with every chat message. If the email can't be sent the chat still starts, and
 * the details are written to the server log so the lead isn't lost.
 *
 * With Go High Level set up, the lead is also added there as a contact
 * tagged with the chat and with each kind of text message they ticked the
 * box for (both boxes are optional). If that fails the host is told by
 * email; the chat starts either way.
 */

const reason = (err: unknown) => (err instanceof Error ? err.message : String(err));

const limiter = createRateLimiter({ limit: 5, windowMs: 60 * 60_000 });

export async function POST(request: NextRequest): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return errorResponse('Chat isn’t available right now.', 503);
  if (!isSameOrigin(request)) return errorResponse('Forbidden.', 403);
  const rate = limiter.check(clientIp(request.headers));
  if (!rate.allowed) return errorResponse('Too many attempts. Please wait a little, or contact us directly.', 429, { 'Retry-After': String(rate.retryAfter) });

  const parsed = leadRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Please check your details.', 400);
  const { page, smsNonMarketing, smsMarketing, ...lead } = parsed.data;
  const consent = { smsNonMarketing, smsMarketing };

  // The same form is the body of /text-signup; its leads are labelled as sign-ups, not chats.
  const signup = isSignupPage(page);
  const crm = crmConfig();
  const [emailed, added] = await Promise.allSettled([
    sendEmail(leadEmail(lead, { page, consent })),
    crm ? addCrmContact(lead, { source: signup ? SIGNUP_SOURCE : CHAT_SOURCE, tags: [signup ? SIGNUP_TAG : CHAT_TAG, ...consentTags(consent)] }, crm) : null,
  ]);
  if (emailed.status === 'rejected') {
    console.error('[chat] lead email not sent:', reason(emailed.reason));
    console.error('[chat] lead (copy from here):', JSON.stringify({ ...lead, ...consent, page }));
  }
  const problem =
    added.status === 'rejected'
      ? { saved: false, reason: reason(added.reason) }
      : added.value?.tagError
        ? { saved: true, reason: added.value.tagError }
        : null;
  if (problem) {
    console.error(`[chat] Go High Level: ${problem.saved ? 'tags not added' : 'contact not saved'}:`, problem.reason);
    await sendEmail(crmProblemEmail(lead, problem, consent, 'website chat lead')).catch((err) => console.error('[chat] host notice not sent:', reason(err)));
  }
  return json({ token: signLead(lead), firstName: firstName(lead.name) });
}
