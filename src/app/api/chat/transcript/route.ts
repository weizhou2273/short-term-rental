import type { NextRequest } from 'next/server';
import { errorResponse, isSameOrigin, readJson } from '@/lib/api';
import { verifyLead } from '@/lib/chat/lead';
import { transcriptEmail } from '@/lib/chat/lead-email';
import { transcriptRequestSchema } from '@/lib/chat/request';
import { sendEmail } from '@/lib/email/send';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';

/**
 * POST /api/chat/transcript  { lead, messages, page? }   → 204
 *
 * Sent by the widget (navigator.sendBeacon) when the guest closes the chat or
 * leaves the page with new messages. Emails the conversation to the host.
 */

const limiter = createRateLimiter({ limit: 30, windowMs: 60 * 60_000 });

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOrigin(request)) return errorResponse('Forbidden.', 403);
  const rate = limiter.check(clientIp(request.headers));
  if (!rate.allowed) return errorResponse('Too many requests.', 429, { 'Retry-After': String(rate.retryAfter) });

  const parsed = transcriptRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse('Invalid request.', 400);
  const lead = process.env.ANTHROPIC_API_KEY ? verifyLead(parsed.data.lead) : null;
  if (!lead) return errorResponse('Unknown guest.', 401);

  try {
    await sendEmail(transcriptEmail(lead, parsed.data.messages, { page: parsed.data.page }));
  } catch (err) {
    console.error('[chat] transcript email not sent:', err instanceof Error ? err.message : err);
    console.error('[chat] transcript (copy from here):', JSON.stringify({ lead, messages: parsed.data.messages }));
  }
  return new Response(null, { status: 204 });
}
