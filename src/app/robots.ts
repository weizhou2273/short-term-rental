import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

/** /robots.txt: everything but the booking API is open to crawlers. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
