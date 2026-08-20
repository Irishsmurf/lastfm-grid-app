import type { NextConfig } from 'next';
import withPWA from '@ducanh2912/next-pwa';

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  experimental: {
    optimizeCss: true,
    // Rewrites barrel imports to deep ones so only the icons/components actually
    // used are pulled into a chunk.
    optimizePackageImports: ['lucide-react', '@radix-ui/react-select'],
  },
  compiler: {
    // console.error is kept so genuine failures still surface in production.
    removeConsole:
      process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lastfm.freetls.fastly.net',
        pathname: '/**',
      },
    ],
    // Album art dominates the bytes on this page; AVIF/WebP cut it substantially.
    formats: ['image/avif', 'image/webp'],
    // Last.fm art URLs are content-addressed, so an optimized variant never goes
    // stale. A long TTL avoids re-running (and re-billing) the same transform.
    minimumCacheTTL: 31536000,
  },
  async headers() {
    return [
      {
        // Apply these headers to all routes in your application.
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

const pwaConfig = {
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  dynamicStartUrl: false,
};

export default withPWA(pwaConfig)(nextConfig);
