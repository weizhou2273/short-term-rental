import type { MetadataRoute } from 'next';
import { GUIDES, guideHomes, guidePath } from '@/data/guides';
import { PROPERTIES } from '@/data/properties';
import { absoluteUrl, stayPath, stayPhotoUrls } from '@/lib/seo';

/** /sitemap.xml: the pages search engines should index, with each stay's lead photos. Hidden stays and empty guides are left out. */
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
    { url: absoluteUrl('/poconos'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    ...GUIDES.filter((g) => guideHomes(g, PROPERTIES).length > 0).map((g) => ({
      url: absoluteUrl(guidePath(g)),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    { url: absoluteUrl('/search'), lastModified: now, changeFrequency: 'daily', priority: 0.7 },
  ];
}
