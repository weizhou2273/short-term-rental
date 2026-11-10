import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { SITE } from '@/data/site';
import { searchProperties } from '@/lib/hospitable/search';
import { dateContext, SYSTEM_TEXT } from './prompt';
import type { ChatEvent } from './shared';
import { CHECK_AVAILABILITY, checkAvailability, checkAvailabilityInput, checkAvailabilityTool, type ToolOutcome } from './tools';

/**
 * One chat reply: a manual tool-use loop over a streamed Messages API call.
 * Text streams to the browser as it is written; check_availability runs here
 * on the server, so the Hospitable token never leaves it.
 */

export const CHAT_MODEL = 'claude-opus-5-5';
// Covers the model's (low-effort) thinking as well as the reply.
const MAX_TOKENS = 6000;
// Model calls per reply: plenty for "check dates, then answer", and a cap on cost.
const MAX_MODEL_CALLS = 5;
// Consecutive re-tries of a turn whose tool input wasn't parseable JSON.
const MAX_JSON_RETRIES = 2;

export type ChatTurn = { role: 'user' | 'assistant'; content: string };
export type { ChatEvent };

export const HANDOFF_TEXT = `Sorry, I can’t help with that here. For anything about a stay, text or call ${SITE.contactPhone} or email ${SITE.contactEmail}.`;

/**
 * The assistant turn to send back in the loop. After a mid-output fallback
 * to another model, blocks the declining model wrote before the last
 * `fallback` boundary (thinking, tool_use) can't be echoed; text and the
 * boundary block itself stay where they were.
 */
export function echoContent(content: BetaContentBlock[]): BetaContentBlockParam[] {
  const boundary = content.map((b) => b.type).lastIndexOf('fallback');
  return content.filter((b, i) => i >= boundary || b.type === 'text') as BetaContentBlockParam[];
}

type RunOptions = {
  client: Pick<Anthropic, 'beta'>;
  history: ChatTurn[];
  /** The guest's first name from the contact form (letters only), so replies can use it. */
  guestName?: string;
  emit: (event: ChatEvent) => void;
  signal?: AbortSignal;
  now?: Date;
  runTool?: (block: BetaToolUseBlock) => Promise<ToolOutcome>;
};

async function runToolDefault(block: BetaToolUseBlock): Promise<ToolOutcome> {
  if (block.name !== CHECK_AVAILABILITY) return { content: `Unknown tool ${block.name}.`, isError: true };
  // With eager input streaming the API doesn't validate the input, and the
  // SDK's tolerant parser can return a truncated object: validate first.
  const parsed = checkAvailabilityInput.safeParse(block.input);
  if (!parsed.success) return { content: JSON.stringify({ INVALID_JSON: JSON.stringify(block.input) }), isError: true };
  return checkAvailability(parsed.data, { search: searchProperties });
}

export async function runChat({ client, history, guestName, emit, signal, now = new Date(), runTool = runToolDefault }: RunOptions): Promise<void> {
  const messages: BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));
  const system = [
    { type: 'text' as const, text: SYSTEM_TEXT, cache_control: { type: 'ephemeral' as const } },
    { type: 'text' as const, text: dateContext(now) + (guestName ? `\nThe guest's first name is ${guestName}.` : '') },
  ];
  let wroteText = false;
  let jsonRetries = 0;

  for (let call = 0; call < MAX_MODEL_CALLS; call++) {
    emit({ type: 'turn' });
    let firstDelta = true;
    const stream = client.beta.messages.stream(
      {
        model: CHAT_MODEL,
        max_tokens: MAX_TOKENS,
        // Opus 5.5 always thinks adaptively; low effort keeps chat replies quick.
        output_config: { effort: 'low' },
        // If the model declines, the API re-runs the request on Anthropic's recommended fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system,
        tools: [checkAvailabilityTool],
        messages,
      },
      { signal },
    );
    stream.on('text', (delta) => {
      // Separate this call's text from the previous call's ("Let me check…" → results).
      emit({ type: 'text', text: firstDelta && wroteText ? `\n\n${delta}` : delta });
      firstDelta = false;
    });
    stream.on('streamEvent', (event) => {
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        emit({ type: 'status', text: 'Checking live availability…' });
      }
    });

    let message: BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // Only a tool input that wasn't parseable JSON is retried; API errors and aborts go up.
      if (err instanceof Anthropic.APIError || signal?.aborted || jsonRetries++ >= MAX_JSON_RETRIES) throw err;
      console.error('[chat] tool input was not parseable JSON; re-issuing the turn');
      emit({ type: 'reset' });
      call--;
      continue;
    }
    const u = message.usage;
    console.info(
      `[chat] ${message.model} stop=${message.stop_reason} in=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens}`,
    );

    if (message.stop_reason === 'refusal') {
      // The whole fallback chain declined: drop any partial reply.
      emit({ type: 'reset' });
      emit({ type: 'text', text: `${wroteText ? '\n\n' : ''}${HANDOFF_TEXT}` });
      return;
    }
    wroteText ||= !firstDelta;

    const content = echoContent(message.content);
    const toolUses = content.filter((b): b is BetaToolUseBlock => b.type === 'tool_use');
    if (message.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content });
      continue;
    }
    if (toolUses.length === 0) return; // end_turn, or a text reply cut off at max_tokens
    // A tool input cut off at max_tokens can still parse; never run it.
    if (message.stop_reason === 'max_tokens') throw new Error('tool input truncated at max_tokens');

    messages.push({ role: 'assistant', content });
    const results: BetaToolResultBlockParam[] = [];
    for (const block of toolUses) {
      const outcome = await runTool(block);
      results.push({ type: 'tool_result', tool_use_id: block.id, content: outcome.content, ...(outcome.isError ? { is_error: true } : {}) });
    }
    messages.push({ role: 'user', content: results });
  }
  throw new Error(`no reply after ${MAX_MODEL_CALLS} model calls`);
}
