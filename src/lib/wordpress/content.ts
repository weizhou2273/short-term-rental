import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { wordPressConfigured } from '@/lib/config/env';
import { wpRequest, WordPressError } from './client';
import { htmlToText, sanitizeCmsHtml, truncateText } from './sanitize';
import type { WpPage, WpPost, WpPropertyContent } from './types';
import { demoPages, demoPosts, demoPropertyContent } from '@/lib/demo/editorial';

export const POSTS_TAG = 'wp:posts';
export const PAGES_TAG = 'wp:pages';
export const PROPERTY_CONTENT_TAG = 'wp:property-content';

const renderedSchema = z.object({ rendered: z.string() }).partial();

const embeddedMediaSchema = z
  .object({
    source_url: z.string().nullish(),
    alt_text: z.string().nullish(),
    media_details: z
      .object({ width: z.number().nullish(), height: z.number().nullish() })
      .nullish(),
  })
  .passthrough();

const wpEntrySchema = z
  .object({
    id: z.number(),
    slug: z.string(),
    date: z.string().nullish(),
    modified: z.string().nullish(),
    title: renderedSchema.nullish(),
    excerpt: renderedSchema.nullish(),
    content: renderedSchema.nullish(),
    _embedded: z
      .object({
        'wp:featuredmedia': z.array(embeddedMediaSchema).nullish(),
        author: z
          .array(
            z
              .object({ name: z.string().nullish(), avatar_urls: z.record(z.string(), z.string()).nullish() })
              .passthrough(),
          )
          .nullish(),
        'wp:term': z.array(z.array(z.object({ name: z.string().nullish() }).passthrough())).nullish(),
      })
      .nullish(),
  })
  .passthrough();

type WpEntry = z.infer<typeof wpEntrySchema>;

/** Average adult reading speed, rounded up so a two-minute read never shows as one. */
function readingMinutes(html: string): number {
  const words = htmlToText(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 225));
}

function mapImage(entry: WpEntry) {
  const media = entry._embedded?.['wp:featuredmedia']?.[0];
  if (!media?.source_url) return null;
  return {
    url: media.source_url,
    alt: media.alt_text?.trim() || '',
    width: media.media_details?.width ?? undefined,
    height: media.media_details?.height ?? undefined,
  };
}

function mapPost(entry: WpEntry): WpPost {
  const content = sanitizeCmsHtml(entry.content?.rendered ?? '');
  const excerptSource = entry.excerpt?.rendered ?? entry.content?.rendered ?? '';
  const author = entry._embedded?.author?.[0];

  return {
    id: entry.id,
    slug: entry.slug,
    title: htmlToText(entry.title?.rendered ?? 'Untitled'),
    excerpt: truncateText(htmlToText(excerptSource), 200),
    content,
    date: entry.date ?? new Date().toISOString(),
    modified: entry.modified ?? entry.date ?? new Date().toISOString(),
    featuredImage: mapImage(entry),
    author: author?.name
      ? {
          name: author.name,
          avatar: author.avatar_urls?.['96'] ?? author.avatar_urls?.['48'] ?? null,
        }
      : null,
    categories:
      entry._embedded?.['wp:term']
        ?.flat()
        .map((term) => term.name?.trim())
        .filter((name): name is string => Boolean(name)) ?? [],
    readingMinutes: readingMinutes(content),
  };
}

function mapPage(entry: WpEntry): WpPage {
  const content = sanitizeCmsHtml(entry.content?.rendered ?? '');
  return {
    id: entry.id,
    slug: entry.slug,
    title: htmlToText(entry.title?.rendered ?? 'Untitled'),
    content,
    excerpt: truncateText(htmlToText(entry.excerpt?.rendered ?? content), 200),
    featuredImage: mapImage(entry),
    modified: entry.modified ?? new Date().toISOString(),
  };
}

/** Every CMS read degrades to demo content rather than breaking the page. */
async function safely<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!wordPressConfigured()) return fallback;
  try {
    return await fn();
  } catch (error) {
    if (error instanceof WordPressError && error.status === 404) return fallback;
    console.error(`[wordpress] ${label} failed; serving fallback content`, error);
    return fallback;
  }
}

export const getPosts = cache(async (limit = 12): Promise<WpPost[]> =>
  safely(
    'posts',
    async () => {
      const rows = await wpRequest<unknown[]>('/posts', {
        query: { per_page: limit, _embed: 'wp:featuredmedia,author,wp:term', status: 'publish' },
        tags: [POSTS_TAG],
      });
      const parsed = rows.map((row) => wpEntrySchema.safeParse(row));
      const posts = parsed.filter((r) => r.success).map((r) => mapPost(r.data));
      return posts.length > 0 ? posts : demoPosts.slice(0, limit);
    },
    demoPosts.slice(0, limit),
  ),
);

export const getPostBySlug = cache(async (slug: string): Promise<WpPost | null> => {
  const fallback = demoPosts.find((post) => post.slug === slug) ?? null;
  return safely(
    `post ${slug}`,
    async () => {
      const rows = await wpRequest<unknown[]>('/posts', {
        query: { slug, _embed: 'wp:featuredmedia,author,wp:term', per_page: 1 },
        tags: [POSTS_TAG, `wp:post:${slug}`],
      });
      const parsed = wpEntrySchema.safeParse(rows[0]);
      return parsed.success ? mapPost(parsed.data) : fallback;
    },
    fallback,
  );
});

export const getPageBySlug = cache(async (slug: string): Promise<WpPage | null> => {
  const fallback = demoPages.find((page) => page.slug === slug) ?? null;
  return safely(
    `page ${slug}`,
    async () => {
      const rows = await wpRequest<unknown[]>('/pages', {
        query: { slug, _embed: 'wp:featuredmedia', per_page: 1 },
        tags: [PAGES_TAG, `wp:page:${slug}`],
      });
      const parsed = wpEntrySchema.safeParse(rows[0]);
      return parsed.success ? mapPage(parsed.data) : fallback;
    },
    fallback,
  );
});

/**
 * Per-property editorial overrides.
 *
 * Modelled as a WordPress custom post type (`property`) whose ACF/meta carries
 * the OwnerRez property id. This is the seam that lets a marketing team rewrite
 * a headline or add neighbourhood copy without an OwnerRez login, while
 * OwnerRez stays the source of truth for rates, calendars and capacity.
 */
const propertyContentSchema = z
  .object({
    slug: z.string(),
    title: renderedSchema.nullish(),
    content: renderedSchema.nullish(),
    excerpt: renderedSchema.nullish(),
    acf: z
      .object({
        ownerrez_property_id: z.union([z.number(), z.string()]).nullish(),
        headline: z.string().nullish(),
        highlights: z.union([z.string(), z.array(z.string())]).nullish(),
        neighbourhood: z.string().nullish(),
        seo_title: z.string().nullish(),
        seo_description: z.string().nullish(),
      })
      .passthrough()
      .nullish(),
    meta: z
      .object({ ownerrez_property_id: z.union([z.number(), z.string()]).nullish() })
      .passthrough()
      .nullish(),
  })
  .passthrough();

function toHighlights(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : value.split('\n');
  return list.map((item) => htmlToText(item)).filter(Boolean).slice(0, 6);
}

export const getPropertyContent = cache(
  async (): Promise<Map<number, WpPropertyContent>> =>
    safely(
      'property content',
      async () => {
        const rows = await wpRequest<unknown[]>('/property', {
          query: { per_page: 100, status: 'publish' },
          tags: [PROPERTY_CONTENT_TAG],
        });

        const out = new Map<number, WpPropertyContent>();
        for (const row of rows) {
          const parsed = propertyContentSchema.safeParse(row);
          if (!parsed.success) continue;
          const rawId =
            parsed.data.acf?.ownerrez_property_id ?? parsed.data.meta?.ownerrez_property_id;
          const propertyId = Number.parseInt(String(rawId ?? ''), 10);
          if (!Number.isFinite(propertyId)) continue;

          out.set(propertyId, {
            propertyId,
            headline: parsed.data.acf?.headline?.trim() || null,
            intro: parsed.data.excerpt?.rendered
              ? htmlToText(parsed.data.excerpt.rendered)
              : null,
            body: parsed.data.content?.rendered
              ? sanitizeCmsHtml(parsed.data.content.rendered)
              : null,
            highlights: toHighlights(parsed.data.acf?.highlights),
            neighbourhood: parsed.data.acf?.neighbourhood
              ? sanitizeCmsHtml(parsed.data.acf.neighbourhood)
              : null,
            seoTitle: parsed.data.acf?.seo_title?.trim() || null,
            seoDescription: parsed.data.acf?.seo_description?.trim() || null,
          });
        }
        return out.size > 0 ? out : demoPropertyContent();
      },
      demoPropertyContent(),
    ),
);
