import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the root so a lockfile or config in a parent directory (e.g. a stray
  // ~/package-lock.json on a dev machine) is never picked up instead of this one.
  turbopack: { root: path.join(__dirname) },
  images: {
    // Only property photos in /public/photos are resized, and only without a
    // query string, so the optimizer can't be pointed at anything else.
    localPatterns: [{ pathname: '/photos/**', search: '' }],
    // A short size list means each photo is only resized a few ways (Vercel
    // counts every resize). Cache lifetime stays at the default (4 hours) so a
    // photo replaced under the same filename updates the same day.
    deviceSizes: [640, 828, 1080, 1440, 1920],
    imageSizes: [256, 384],
    qualities: [75],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
