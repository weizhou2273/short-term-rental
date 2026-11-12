import type { NextRequest } from 'next/server';
import { errorResponse, isSameOrigin, json, readJson } from '@/lib/api';
import { leadSchema } from '@/lib/chat/request';
import { addContact, sendEmail } from '@/lib/email/send';
import { signupNoticeEmail, welcomeEmail, welcomeOffer } from '@/lib/offer/welcome';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';

/**
 * POST /api/subscribe  { name, email, phone }
 *   → 200 { code, percent, emailed }
 *
 * The welcome-offer popup, all within the request (a second or two):
 *   1. adds the guest's name and email to the Resend contact list;
 *   2. emails the guest their code and three questions from the host
 *      (dates, group size, occasion), with replies going to the host;
 *   3. emails the host "New sign-up" with the name, email and phone,
 *      Reply going to the guest.
 * The code is returned either way, so a guest who signed up is never left
 * without it, and the host hears about every sign-up even if 1 or 2 fail.
 */

const reason = (err: unknown) => (err instanceof Error ? err.message : String(err));

const limiter = createRateLimiter({ limit: 5, windowMs: 60 * 60_000 });


export async function POST(request: NextRequest): Promise<Response> {
  const offer = welcomeOffer();
  if (!offer) return errorResponse('This offer isn’t available right now.', 503);
  if (!isSameOrigin(request)) return errorResponse('Forbidden.', 403);
  const rate = limiter.check(clientIp(request.headers));
  if (!rate.allowed) return errorResponse('Too many sign-ups. Please wait a little and try again.', 429, { 'Retry-After': String(rate.retryAfter) });

  // The same name, email and phone rules as the chat's sign-in.
  const parsed = leadSchema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Please check your name, email and phone number.', 400);
  const lead = parsed.data;
  const { name, email } = lead;

  const [saved, emailed] = await Promise.allSettled([addContact(email, name), sendEmail(welcomeEmail(email, offer, name))]);
  if (saved.status === 'rejected') {
    console.error('[subscribe] contact not saved:', reason(saved.reason));
    console.error('[subscribe] details (copy from here):', JSON.stringify(lead));
  }
  if (emailed.status === 'rejected') console.error('[subscribe] welcome email not sent:', reason(emailed.reason));
  // Tell the host right away, so they can follow up while the guest is still on the site.
  const status = saved.status === 'fulfilled' ? ({ saved: true } as const) : ({ saved: false, reason: reason(saved.reason).slice(0, 200) } as const);
  await sendEmail(signupNoticeEmail(lead, status, emailed.status === 'fulfilled')).catch((err) =>
    console.error('[subscribe] host notice not sent:', reason(err)),
  );
  return json({ code: offer.code, percent: offer.percent, emailed: emailed.status === 'fulfilled' });
}
