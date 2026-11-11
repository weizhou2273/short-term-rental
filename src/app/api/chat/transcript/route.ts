import Anthropic from '@anthropic-ai/sdk';
import type { NextRequest } from 'next/server';
import { errorResponse, isSameOrigin, readJson } from '@/lib/api';
import { verifyLead } from '@/lib/chat/lead';
import { transcriptEmail } from '@/lib/chat/lead-email';
import { sendRecap } from '@/lib/chat/recap';
import { transcriptRequestSchema } from '@/lib/chat/request';
import { canEmailGuests, sendEmail, sentRecently } from '@/lib/email/send';
import { searchProperties } from '@/lib/hospitable/search';
import { welcomeOffer } from '@/lib/offer/welcome';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';

/**
 * POST /api/chat/transcript  { lead, messages, page? }   → 204
 *
 * Sent by the widget (navigator.sendBeacon) when the guest closes the chat or
 * leaves the page with new messages. Emails the conversation to the host,
 * then (once a day at most) the guest's recap from Edward: see lib/chat/recap.ts.
 */

const limiter = createRateLimiter({ limit: 30, windowMs: 60 * 60_000 });

// Reading the chat with Claude and checking availability take a few seconds.
export const maxDuration = 60;

let client: Anthropic | null = null;

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

  // The guest's follow-up from Edward: their dates, what's open with live prices, and "just reply".
  if (!canEmailGuests()) {
    console.info('[recap] skipped: guests can only be emailed once wkreserve.com is verified in Resend (LEADS_FROM_EMAIL)');
    return new Response(null, { status: 204 });
  }
  try {
    client ??= new Anthropic();
    const outcome = await sendRecap(lead, parsed.data.messages, {
      client,
      search: searchProperties,
      send: sendEmail,
      alreadySent: sentRecently,
      offer: welcomeOffer(),
    });
    console.info(`[recap] ${outcome} (${lead.email})`);
  } catch (err) {
    console.error('[recap] not sent:', err instanceof Error ? err.message : err);
  }
  return new Response(null, { status: 204 });
}
