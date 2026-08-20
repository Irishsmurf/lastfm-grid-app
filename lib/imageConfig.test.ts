import nextConfig from '../next.config';

describe('Next.js Configuration & Regression Tests', () => {
  describe('Image Remote Patterns', () => {
    const sampleLastFmImageUrls = [
      'https://lastfm.freetls.fastly.net/i/u/300x300/466f8fd2eaf94f5a92d44c63ffc8b33a.jpg',
      'https://lastfm-img.freetls.fastly.net/i/u/300x300/1c2a2f3bee49cc952f5d0b7916e4e509.png',
      'https://lastfm-img2.freetls.fastly.net/i/u/300x300/7384e60ccd4592662d959e2ec5335864.jpg',
    ];

    it('matches all Last.fm image CDN domains to prevent 400 Bad Request image optimization errors', () => {
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

        expect(matchesPattern).toBe(true);
      }
    });
  });
});
