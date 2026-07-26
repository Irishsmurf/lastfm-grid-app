/**
 * Server-side cache configuration.
 *
 * These values used to be read from Firebase Remote Config, but `remoteConfig` is
 * always `null` on the server (see `lib/firebase.ts`) — the SDK needs browser APIs.
 * Every server-side `getRemoteConfigValue()` call therefore returned the hardcoded
 * default while still pulling the whole Firebase client SDK into the server bundle.
 * Plain constants are honest about that and keep Firebase out of the API routes.
 */

/** How long a successful Last.fm album list stays cached, by period. */
const ALBUMS_TTL_BY_PERIOD: Record<string, number> = {
  '7day': 1800, // 30m — moves fastest
  '1month': 3600,
  '3month': 3600,
  '6month': 21600, // 6h — long windows barely shift day to day
  '12month': 21600,
  overall: 21600,
};

const ALBUMS_TTL_DEFAULT = 3600;

export function albumsTtlSeconds(period: string): number {
  return ALBUMS_TTL_BY_PERIOD[period] ?? ALBUMS_TTL_DEFAULT;
}

/**
 * Negative cache for album lookups — short on purpose. This is what a typo'd or
 * brand-new username hits, and a long TTL means a real user who just signed up
 * sees an empty grid until it expires.
 */
export const ALBUMS_NOT_FOUND_TTL = 600; // 10m

/**
 * An album -> Spotify URL mapping is effectively immutable, so this can be long.
 * It was previously 3600 (via the Remote Config default), which produced roughly
 * 24x more Spotify search traffic than the route intended.
 */
export const SPOTIFY_LINK_TTL = 2592000; // 30d

/** "Spotify genuinely has no match" is a stable fact; safe to hold for a day. */
export const SPOTIFY_NOT_FOUND_TTL = 86400; // 24h

/**
 * Cache-Control builder.
 *
 * Two tiers, because the CDN and the browser want different answers: the edge can
 * hold content far longer than a browser should, since a purge reaches the edge but
 * never reaches a browser that already cached the response.
 *
 * `Vercel-CDN-Cache-Control` targets the Vercel edge specifically and is stripped
 * before the response reaches the client, so it does not constrain the browser.
 */
export function cacheHeaders(opts: {
  /** Edge TTL in seconds. */
  cdn: number;
  /** Browser TTL in seconds. */
  browser: number;
  /** Edge may serve stale for this long while revalidating. */
  swr?: number;
  /** Marks the body as never changing for its URL. */
  immutable?: boolean;
}): Record<string, string> {
  const { cdn, browser, swr, immutable } = opts;

  const cdnValue = [
    `max-age=${cdn}`,
    swr ? `stale-while-revalidate=${swr}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const browserValue = [
    'public',
    `max-age=${browser}`,
    immutable ? 'immutable' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    'Vercel-CDN-Cache-Control': cdnValue,
    'Cache-Control': browserValue,
  };
}

/** For anything that must never be cached: errors, health, metrics. */
export const NO_STORE: Record<string, string> = {
  'Cache-Control': 'no-store, must-revalidate',
};
