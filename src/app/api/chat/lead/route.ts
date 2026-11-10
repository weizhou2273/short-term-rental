import type { NextRequest } from 'next/server';
import { errorResponse, isSameOrigin, json, readJson } from '@/lib/api';
import { signLead } from '@/lib/chat/lead';
import { leadEmail } from '@/lib/chat/lead-email';
import { leadRequestSchema } from '@/lib/chat/request';
import { firstName } from '@/lib/chat/shared';
import { sendEmail } from '@/lib/email/send';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';

/**
 * POST /api/chat/lead  { name, email, phone, page? }
 *   → 200 { token, firstName }  and an email to the host with the details.
 *
 * The chat asks for these before the first question. The token goes with
 * every chat message. If the email can't be sent the chat still starts, and
 * the details are written to the server log so the lead isn't lost.
 */

const limiter = createRateLimiter({ limit: 5, windowMs: 60 * 60_000 });

export async function POST(request: NextRequest): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return errorResponse('Chat isn’t available right now.', 503);
  if (!isSameOrigin(request)) return errorResponse('Forbidden.', 403);
  const rate = limiter.check(clientIp(request.headers));
  if (!rate.allowed) return errorResponse('Too many attempts. Please wait a little, or contact us directly.', 429, { 'Retry-After': String(rate.retryAfter) });

  const parsed = leadRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Please check your details.', 400);
  const { page, ...lead } = parsed.data;

  try {
    await sendEmail(leadEmail(lead, { page }));
  } catch (err) {
    console.error('[chat] lead email not sent:', err instanceof Error ? err.message : err);
    console.error('[chat] lead (copy from here):', JSON.stringify({ ...lead, page }));
  }
  return json({ token: signLead(lead), firstName: firstName(lead.name) });
}
