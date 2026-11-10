import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, isSameOrigin, json, readJson } from '@/lib/api';
import { addContact, sendEmail } from '@/lib/email/send';
import { signupNoticeEmail, welcomeEmail, welcomeOffer } from '@/lib/offer/welcome';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';

/**
 * POST /api/subscribe  { email }
 *   → 200 { code, percent, emailed }
 *
 * The welcome-offer popup: adds the email to the Resend contact list and
 * emails the guest their code. The code is returned either way, so a guest
 * who signed up is never left without it. If saving the contact fails (for
 * example a "Sending access" key), the address is emailed to the host and
 * written to the server log instead.
 */

const limiter = createRateLimiter({ limit: 5, windowMs: 60 * 60_000 });

const schema = z.object({
  email: z.string().trim().max(254).pipe(z.email('Please enter a valid email address.')),
});

export async function POST(request: NextRequest): Promise<Response> {
  const offer = welcomeOffer();
  if (!offer) return errorResponse('This offer isn’t available right now.', 503);
  if (!isSameOrigin(request)) return errorResponse('Forbidden.', 403);
  const rate = limiter.check(clientIp(request.headers));
  if (!rate.allowed) return errorResponse('Too many sign-ups. Please wait a little and try again.', 429, { 'Retry-After': String(rate.retryAfter) });

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Please enter a valid email address.', 400);
  const { email } = parsed.data;

  const [saved, emailed] = await Promise.allSettled([addContact(email), sendEmail(welcomeEmail(email, offer))]);
  if (saved.status === 'rejected') {
    const reason = saved.reason instanceof Error ? saved.reason.message : String(saved.reason);
    console.error('[subscribe] contact not saved:', reason);
    console.error('[subscribe] email (copy from here):', email);
    // Send the address to the host instead, so the sign-up isn't lost.
    await sendEmail(signupNoticeEmail(email, reason.slice(0, 200))).catch((err) =>
      console.error('[subscribe] host notice not sent:', err instanceof Error ? err.message : err),
    );
  }
  if (emailed.status === 'rejected') {
    console.error('[subscribe] welcome email not sent:', emailed.reason instanceof Error ? emailed.reason.message : emailed.reason);
  }
  return json({ code: offer.code, percent: offer.percent, emailed: emailed.status === 'fulfilled' });
}
