import { redis } from '@/lib/redis';
import { logger } from '@/utils/logger';
import { SPOTIFY_LINK_TTL, SPOTIFY_NOT_FOUND_TTL } from '@/lib/config';
import type { MinimizedAlbum } from '@/lib/minimizedLastfmService';

const CTX = 'SpotifyService';
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_ACCESS_TOKEN_REDIS_KEY = 'spotify:accessToken';

/** Redis placeholder for "Spotify has no match", shared with the cache layer. */
export const SPOTIFY_NOT_FOUND_PLACEHOLDER = 'SPOTIFY_NOT_FOUND';

/**
 * The single source of truth for the per-album cache key.
 *
 * Both GET /api/spotify-link and the batch resolver below must produce byte-identical
 * keys — if they drift, the two paths silently stop sharing cache entries and Spotify
 * quota consumption doubles without anything visibly breaking.
 */
export function spotifyLinkCacheKey(
  artistName: string,
  albumName: string
): string {
  return `spotify:link:${encodeURIComponent(artistName)}:${encodeURIComponent(albumName)}`;
}

async function refreshSpotifyToken(): Promise<string> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error(
      'Spotify client ID or secret not configured in environment variables'
    );
  }
  const credentials = Buffer.from(
    `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    throw new Error(`Spotify token request failed: ${res.status}`);
  }
  const data = await res.json();
  const accessToken = data?.access_token;
  const expiresIn = data?.expires_in;
  if (typeof accessToken !== 'string' || typeof expiresIn !== 'number') {
    throw new Error('Invalid token response structure from Spotify');
  }
  await redis.setex(
    SPOTIFY_ACCESS_TOKEN_REDIS_KEY,
    expiresIn - 300,
    accessToken
  );
  logger.info(CTX, 'Spotify access token refreshed and stored in Redis.');
  return accessToken;
}

async function getAccessToken(): Promise<string> {
  let token = await redis.get(SPOTIFY_ACCESS_TOKEN_REDIS_KEY);
  if (!token) {
    logger.info(
      CTX,
      'Spotify access token not found in Redis or expired, refreshing...'
    );
    token = await refreshSpotifyToken();
  } else {
    logger.info(CTX, 'Spotify access token retrieved from Redis.');
  }
  return token;
}

export async function searchAlbum(
  albumName: string,
  artistName: string
): Promise<{ spotifyUrl: string | null }> {
  logger.info(
    CTX,
    `Searching for album on Spotify: ${albumName} by ${artistName}`
  );
  try {
    const token = await getAccessToken();
    const query = encodeURIComponent(`album:${albumName} artist:${artistName}`);
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${query}&type=album&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      logger.error(CTX, `Spotify search request failed: ${res.status}`);
      return { spotifyUrl: null };
    }
    const data = await res.json();
    const spotifyUrl = data.albums?.items?.[0]?.external_urls?.spotify;
    if (spotifyUrl) {
      logger.info(
        CTX,
        `Found Spotify URL for ${albumName} by ${artistName}: ${spotifyUrl}`
      );
      return { spotifyUrl };
    }
    logger.info(CTX, `No Spotify URL found for ${albumName} by ${artistName}`);
    return { spotifyUrl: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error;
    logger.error(CTX, `Error searching for album on Spotify: ${errorMessage}`);
    return { spotifyUrl: null };
  }
}

/**
 * Result of a batch link resolution.
 *
 * `links` is keyed by album mbid. A `null` value means "resolved, no Spotify match";
 * an absent key means "not resolved yet" — the client should fall back to
 * GET /api/spotify-link for those rather than rendering them as unavailable.
 */
export interface ResolvedSpotifyLinks {
  links: Record<string, string | null>;
  /** False when the deadline elapsed with albums still unresolved. */
  complete: boolean;
}

/** Bounded fan-out, so a 25-album grid can't open 25 sockets to Spotify at once. */
const SEARCH_CONCURRENCY = 5;

/**
 * Resolves Spotify links for a whole grid server-side.
 *
 * This exists to remove a full round-trip stage from the client: the browser used to
 * wait for /api/albums, render, and only then fire one /api/spotify-link request per
 * album. The server already has the album list and a warm token, so it can answer in
 * the same response.
 *
 * Cached links come back in a single MGET rather than N round trips. Anything still
 * missing is searched under a deadline — a cold Spotify slows the response by at most
 * `deadlineMs`, after which whatever resolved is returned and the rest is left to the
 * client's per-album fallback.
 */
export async function resolveSpotifyLinks(
  albums: MinimizedAlbum[],
  opts: { deadlineMs?: number } = {}
): Promise<ResolvedSpotifyLinks> {
  const { deadlineMs = 700 } = opts;
  const links: Record<string, string | null> = {};

  // Albums without an mbid have no stable key for the client to look up.
  const candidates = albums.filter((album) => album.mbid);
  if (candidates.length === 0) return { links, complete: true };

  const keys = candidates.map((album) =>
    spotifyLinkCacheKey(album.artist.name, album.name)
  );

  let cached: (string | null)[] = [];
  try {
    cached = await redis.mget(...keys);
  } catch (error) {
    // A cache read failure shouldn't fail the grid — fall through and treat
    // everything as a miss.
    logger.warn(
      CTX,
      `Batch link cache read failed: ${error instanceof Error ? error.message : String(error)}`
    );
    cached = keys.map(() => null);
  }

  const misses: { album: MinimizedAlbum; key: string }[] = [];

  candidates.forEach((album, i) => {
    const value = cached[i];
    if (value === SPOTIFY_NOT_FOUND_PLACEHOLDER) {
      links[album.mbid] = null;
      return;
    }
    if (value) {
      try {
        links[album.mbid] = JSON.parse(value).spotifyUrl ?? null;
        return;
      } catch {
        // Corrupt entry — treat as a miss and let it be rewritten.
      }
    }
    misses.push({ album, key: keys[i] });
  });

  if (misses.length === 0) return { links, complete: true };

  const deadline = Date.now() + deadlineMs;
  let index = 0;
  let timedOut = false;

  const worker = async () => {
    while (index < misses.length) {
      if (Date.now() >= deadline) {
        timedOut = true;
        return;
      }
      const { album, key } = misses[index++];
      try {
        const { spotifyUrl } = await searchAlbum(album.name, album.artist.name);
        links[album.mbid] = spotifyUrl;

        // Write through with the same TTLs the single-album route uses.
        if (spotifyUrl) {
          await redis.setex(
            key,
            SPOTIFY_LINK_TTL,
            JSON.stringify({ spotifyUrl })
          );
        } else {
          await redis.setex(
            key,
            SPOTIFY_NOT_FOUND_TTL,
            SPOTIFY_NOT_FOUND_PLACEHOLDER
          );
        }
      } catch (error) {
        // Deliberately not cached: a transient Spotify or Redis failure must not
        // be written as "no match", or a blip would blank these links for a day.
        logger.warn(
          CTX,
          `Link resolution failed for ${album.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(SEARCH_CONCURRENCY, misses.length) }, worker)
  );

  const complete = !timedOut && candidates.every((a) => a.mbid in links);
  return { links, complete };
}
