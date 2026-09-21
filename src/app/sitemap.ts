import type { MetadataRoute } from 'next';
import { getProperties } from '@/lib/ownerrez/properties';
import { getPosts } from '@/lib/wordpress/content';
import { absoluteUrl } from '@/lib/config/metadata';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [properties, posts] = await Promise.all([getProperties(), getPosts(100)]);
  const now = new Date();

  return [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'weekly', priority: 1 },
    {
      url: absoluteUrl('/properties'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    { url: absoluteUrl('/journal'), lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: absoluteUrl('/about'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/contact'), lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: absoluteUrl('/terms'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    ...properties.map((property) => ({
      url: absoluteUrl(`/properties/${property.slug}`),
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.95,
    })),
    ...posts.map((post) => ({
      url: absoluteUrl(`/journal/${post.slug}`),
      lastModified: new Date(post.modified),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
