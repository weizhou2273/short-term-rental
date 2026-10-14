import type { MetadataRoute } from 'next';
import { PROPERTIES } from '@/data/properties';
import { absoluteUrl, stayPath, stayPhotoUrls } from '@/lib/seo';

/** /sitemap.xml: the pages search engines should index, with each stay's lead photos. Hidden stays are left out. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    ...PROPERTIES.map((p) => ({
      url: absoluteUrl(stayPath(p)),
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.9,
      images: stayPhotoUrls(p),
    })),
    { url: absoluteUrl('/search'), lastModified: now, changeFrequency: 'daily', priority: 0.7 },
  ];
}
