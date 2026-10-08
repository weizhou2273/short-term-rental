import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the root so a lockfile or config in a parent directory (e.g. a stray
  // ~/package-lock.json on a dev machine) is never picked up instead of this one.
  turbopack: { root: path.join(__dirname) },
  images: {
    // Property photos come only from Hospitable's asset host.
    remotePatterns: [new URL('https://assets.hospitable.com/property_images/**')],
    // Each photo has a unique filename, so a resized copy never goes stale:
    // cache it for 31 days, and keep the size list short so each photo is
    // only resized a few ways (Vercel counts every resize).
    minimumCacheTTL: 2_678_400,
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
