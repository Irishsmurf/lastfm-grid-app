import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [{
        protocol: 'https',
        hostname: 'lastfm.freetls.fastly.net',
        pathname: '/**',
      }
    ]
  },
};

const pwaConfig = {
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
};

export default withPWA(pwaConfig)(nextConfig);
