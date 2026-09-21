/**
 * Stripe caps each metadata value at 500 characters and allows up to 50 keys.
 * A signed booking draft is comfortably longer than one value, so it is split
 * across numbered keys and reassembled on the way back in.
 */

const CHUNK = 450;
const MAX_CHUNKS = 12;

export function chunkToken(prefix: string, token: string): Record<string, string> {
  const chunks: Record<string, string> = {};
  const count = Math.ceil(token.length / CHUNK);

  if (count > MAX_CHUNKS) {
    throw new RangeError(
      `Token of ${token.length} chars exceeds the ${MAX_CHUNKS * CHUNK} char metadata budget`,
    );
  }

  for (let i = 0; i < count; i += 1) {
    chunks[`${prefix}_${i}`] = token.slice(i * CHUNK, (i + 1) * CHUNK);
  }
  chunks[`${prefix}_n`] = String(count);
  return chunks;
}

/** Returns null when the metadata carries no token, or carries a partial one. */
export function unchunkToken(
  prefix: string,
  metadata: Record<string, string> | null | undefined,
): string | null {
  if (!metadata) return null;
  const count = Number.parseInt(metadata[`${prefix}_n`] ?? '', 10);
  if (!Number.isFinite(count) || count <= 0 || count > MAX_CHUNKS) return null;

  let out = '';
  for (let i = 0; i < count; i += 1) {
    const part = metadata[`${prefix}_${i}`];
    // A missing chunk means a truncated or tampered payload — refuse it whole
    // rather than hand a half-token to the signature check.
    if (part === undefined) return null;
    out += part;
  }
  return out;
}
