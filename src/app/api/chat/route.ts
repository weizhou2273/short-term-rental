import Anthropic from '@anthropic-ai/sdk';
import type { NextRequest } from 'next/server';
import { errorResponse } from '@/lib/api';
import { type ChatEvent, runChat } from '@/lib/chat/agent';
import { chatRequestSchema } from '@/lib/chat/request';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';

/**
 * POST /api/chat  { messages: [{ role, content }] }  (text only; the last one is the guest's)
 *   → 200 application/x-ndjson, one ChatEvent per line, ending in "done" or "error"
 *
 * Needs ANTHROPIC_API_KEY (server only). Without it the route answers 503
 * and the layout doesn't render the chat button.
 */

// A reply with an availability check is two model calls plus a Hospitable search.
export const maxDuration = 60;

// Each message is a paid model call, so keep one visitor well inside normal use.
const burst = createRateLimiter({ limit: 10, windowMs: 5 * 60_000 });
const daily = createRateLimiter({ limit: 60, windowMs: 24 * 60 * 60_000 });

let client: Anthropic | null = null;

/** Only our own pages may call this from a browser. */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

function guestMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error('[chat] ANTHROPIC_API_KEY was rejected', err.message);
  } else {
    console.error('[chat]', err);
  }
  if (err instanceof Anthropic.RateLimitError || (err instanceof Anthropic.APIError && err.status === 529)) {
    return 'The assistant is busy right now. Please try again in a minute, or contact us directly.';
  }
  return 'The assistant couldn’t answer just now. Please try again, or contact us directly.';
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return errorResponse('Chat isn’t available right now.', 503);
  if (!sameOrigin(request)) return errorResponse('Forbidden.', 403);

  const ip = clientIp(request.headers);
  for (const limiter of [burst, daily]) {
    const rate = limiter.check(ip);
    if (!rate.allowed) {
      return errorResponse('You’ve sent a lot of messages. Please wait a little, or contact us directly.', 429, {
        'Retry-After': String(rate.retryAfter),
      });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid request.', 400);
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid request.', 400);

  client ??= new Anthropic();
  const anthropic = client;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The browser went away; runChat stops via request.signal.
        }
      };
      try {
        await runChat({ client: anthropic, history: parsed.data.messages, emit: send, signal: request.signal });
        send({ type: 'done' });
      } catch (err) {
        // The guest closed the chat or left the page: nothing to send.
        if (!request.signal.aborted) send({ type: 'error', message: guestMessage(err) });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by a disconnect.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
