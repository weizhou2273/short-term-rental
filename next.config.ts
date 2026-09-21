import type { NextConfig } from 'next';

/**
 * Remote image hosts. OwnerRez serves property photography from its own CDN;
 * WordPress serves editorial media from the configured CMS origin.
 */
function cmsHostname(): string | null {
  const url = process.env.WORDPRESS_API_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const cmsHost = cmsHostname();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.ownerrez.com' },
      { protocol: 'https', hostname: '**.ownerreservations.com' },
      ...(cmsHost ? [{ protocol: 'https' as const, hostname: cmsHost }] : []),
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
