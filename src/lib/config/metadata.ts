import type { Metadata } from 'next';
import { env } from '@/lib/config/env';
import { site } from '@/lib/config/site';

export function siteUrl(): string {
  return env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

type PageMetaInput = {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: 'website' | 'article';
  publishedTime?: string;
  /** Pages behind a booking flow should never be indexed. */
  noIndex?: boolean;
};

export function pageMetadata({
  title,
  description,
  path,
  image,
  type = 'website',
  publishedTime,
  noIndex = false,
}: PageMetaInput): Metadata {
  const url = absoluteUrl(path);
  const images = image ? [{ url: image, alt: title }] : undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      url,
      siteName: site.name,
      type,
      images,
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title,
      description,
      images: images?.map((i) => i.url),
    },
  };
}
