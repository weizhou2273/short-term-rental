import { jsonLdScript } from '@/lib/seo';

/** Structured data for search engines, rendered into the page's HTML. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />;
}
