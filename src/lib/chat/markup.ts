import { SITE } from '@/data/site';

/**
 * The small piece of markdown the assistant writes — paragraphs, "- " lists,
 * **bold** and [links](…) — parsed into plain data the widget renders as
 * React elements (never as HTML). Links survive only if they point at this
 * site, a phone number or an email address; anything else shows as its label.
 */

export type Inline = { type: 'text'; text: string } | { type: 'strong'; text: string } | { type: 'link'; text: string; href: string; internal: boolean };

export type Block = { type: 'p'; lines: Inline[][] } | { type: 'ul'; items: Inline[][] };

const SITE_ORIGIN = new RegExp(`^https?://(www\\.)?${SITE.domain.replace(/\./g, '\\.')}(?=/|$)`, 'i');

/** A safe href for a link the model wrote, or null to show the label as text. */
export function safeHref(raw: string): { href: string; internal: boolean } | null {
  const href = raw.trim().replace(SITE_ORIGIN, '') || '/';
  if (/^\/(?!\/)[\w\-./?=&%#,+]*$/.test(href) && !href.includes('..')) return { href, internal: true };
  if (/^(tel|sms):\+?[\d\-. ()]{7,20}$/i.test(href)) return { href: href.replace(/[^\d+:a-z]/gi, ''), internal: false };
  if (/^mailto:[\w.+-]+@[\w-]+(\.[\w-]+)+$/i.test(href)) return { href, internal: false };
  return null;
}

const INLINE = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
    if (m[1] !== undefined) {
      const safe = safeHref(m[2]!);
      out.push(safe ? { type: 'link', text: m[1], ...safe } : { type: 'text', text: m[1] });
    } else {
      out.push({ type: 'strong', text: m[3]! });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

export function parseChat(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.split(/\n\s*\n/)) {
    const lines = chunk.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    let para: Inline[][] = [];
    let list: Inline[][] = [];
    const flush = () => {
      if (para.length) blocks.push({ type: 'p', lines: para });
      if (list.length) blocks.push({ type: 'ul', items: list });
      para = [];
      list = [];
    };
    for (const line of lines) {
      if (BULLET.test(line)) {
        if (para.length) flush();
        list.push(parseInline(line.replace(BULLET, '')));
      } else {
        if (list.length) flush();
        // Headings aren't wanted in a chat bubble; keep the words.
        para.push(parseInline(line.replace(/^#{1,6}\s+/, '')));
      }
    }
    flush();
  }
  return blocks;
}
