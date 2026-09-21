import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/config/metadata';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Checkout and confirmation carry guest data in the URL and have no
      // search value; keep them out of the index entirely.
      disallow: ['/api/', '/book/', '/booking/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
