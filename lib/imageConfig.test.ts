/** @jest-environment node */
import nextConfig from '../next.config';

describe('Next.js Configuration & Regression Tests', () => {
  describe('Image Remote Patterns', () => {
    const sampleLastFmImageUrls = [
      'https://lastfm.freetls.fastly.net/i/u/300x300/466f8fd2eaf94f5a92d44c63ffc8b33a.jpg',
      'https://lastfm-img.freetls.fastly.net/i/u/300x300/1c2a2f3bee49cc952f5d0b7916e4e509.png',
      'https://lastfm-img2.freetls.fastly.net/i/u/300x300/7384e60ccd4592662d959e2ec5335864.jpg',
      'https://d1234567.cloudfront.net/i/u/300x300/abc.jpg',
      'https://2a.akamaihd.net/i/u/300x300/xyz.png',
      'https://cdn.last.fm/i/u/300x300/def.jpg',
      'https://i.scdn.co/image/ab67616d0000b2731c2a2f3bee49cc952f5d0b79',
    ];

    it('matches all major music & CDN domains (Fastly, CloudFront, Akamai, Spotify) to prevent 400 Bad Request errors', () => {
      const remotePatterns = nextConfig.images?.remotePatterns || [];
      expect(remotePatterns.length).toBeGreaterThan(0);

      for (const urlStr of sampleLastFmImageUrls) {
        const url = new URL(urlStr);
        const protocol = url.protocol.replace(':', '');

        const matchesPattern = remotePatterns.some((pattern) => {
          if (pattern.protocol && pattern.protocol !== protocol) {
            return false;
          }
          if (!pattern.hostname) {
            return false;
          }
          if (pattern.hostname.startsWith('*.')) {
            const domainSuffix = pattern.hostname.slice(2);
            return (
              url.hostname === domainSuffix ||
              url.hostname.endsWith(`.${domainSuffix}`)
            );
          }
          return pattern.hostname === url.hostname;
        });

        expect(matchesPattern, `URL ${urlStr} should be allowed by remotePatterns`).toBe(true);
      }
    });
  });
});
