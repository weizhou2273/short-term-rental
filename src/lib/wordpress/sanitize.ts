import sanitizeHtml from 'sanitize-html';

/**
 * Everything that reaches `dangerouslySetInnerHTML` passes through here.
 *
 * WordPress content is authored by trusted editors, but "trusted" is not a
 * security control: a compromised CMS account, a plugin that injects markup, or
 * a pasted block from an external source would otherwise become stored XSS on
 * the booking site. The allowlist is deliberately narrow — the editorial
 * vocabulary of a property description and nothing more.
 */
const options: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
    'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'figure', 'figcaption',
    'a', 'img', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'code', 'pre', 'span', 'div',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading', 'sizes'],
    span: ['class'],
    div: ['class'],
    figure: ['class'],
    th: ['scope', 'colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  // Blocks `javascript:` and `data:` URLs outright.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  transformTags: {
    // Any link that leaves the site opens safely and without leaking the opener.
    a: (tagName, attribs) => {
      const href = attribs.href ?? '';
      const external = /^https?:\/\//i.test(href);
      return {
        tagName,
        attribs: {
          ...attribs,
          ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
        },
      };
    },
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: 'lazy', decoding: 'async' },
    }),
  },
};

export function sanitizeCmsHtml(html: string): string {
  return sanitizeHtml(html, options);
}

/** Plain text for excerpts, meta descriptions and card summaries. */
export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateText(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}
