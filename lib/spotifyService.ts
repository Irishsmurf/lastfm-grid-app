import SpotifyWebApi from 'spotify-web-api-node';
import { redis } from '@/lib/redis';
import { logger } from '@/utils/logger';

const CTX = 'SpotifyService';
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_ACCESS_TOKEN_REDIS_KEY = 'spotify:accessToken';

// Removed top-level check and spotifyApi instantiation

let spotifyApiInstance: SpotifyWebApi | null = null;

function getSpotifyApiInstance(): SpotifyWebApi {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    logger.error(
      CTX,
      'Spotify client ID or secret not configured in environment variables'
    );
    throw new Error(
      'Spotify client ID or secret not configured in environment variables'
    );
  }
  if (!spotifyApiInstance) {
    spotifyApiInstance = new SpotifyWebApi({
      clientId: SPOTIFY_CLIENT_ID,
      clientSecret: SPOTIFY_CLIENT_SECRET,
    });
  }
  return spotifyApiInstance;
}

async function refreshSpotifyToken(): Promise<string> {
  const spotifyApi = getSpotifyApiInstance();
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    const accessToken = data.body['access_token'];
    const expiresIn = data.body['expires_in'];

    // Store the token in Redis with an expiry time (actual expiry - 5 minutes)
    await redis.setex(
      SPOTIFY_ACCESS_TOKEN_REDIS_KEY,
      expiresIn - 300,
      accessToken
    );
    spotifyApi.setAccessToken(accessToken); // Sets on the singleton instance
    logger.info(CTX, 'Spotify access token refreshed and stored in Redis.');
    return accessToken;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error;
    logger.error(CTX, `Error refreshing Spotify access token: ${errorMessage}`);
    throw new Error('Failed to refresh Spotify access token');
  }
}

async function getAccessToken(): Promise<string> {
  const spotifyApi = getSpotifyApiInstance();
  let token = await redis.get(SPOTIFY_ACCESS_TOKEN_REDIS_KEY);
  if (!token) {
    logger.info(
      CTX,
      'Spotify access token not found in Redis or expired, refreshing...'
    );
    token = await refreshSpotifyToken();
  } else {
    spotifyApi.setAccessToken(token); // Sets on the singleton instance
    logger.info(CTX, 'Spotify access token retrieved from Redis.');
  }
  return token;
}

/**
 * Searches for an album on Spotify given the album name and artist name.
 * It ensures a valid access token is available before making the request.
 *
 * @param {string} albumName The name of the album to search for.
 * @param {string} artistName The name of the artist.
 * @returns {Promise<{ spotifyUrl: string | null }>} A promise that resolves to an object
 * containing the Spotify URL of the album if found, or null otherwise.
 * It also returns null in case of an error during the search.
 */
export async function searchAlbum(
  albumName: string,
  artistName: string
): Promise<{ spotifyUrl: string | null }> {
  const spotifyApi = getSpotifyApiInstance();
  logger.info(
    CTX,
    `Searching for album on Spotify: ${albumName} by ${artistName}`
  );
  try {
    await getAccessToken(); // This ensures the token is set on the shared instance
    const query = `album:${albumName} artist:${artistName}`;
    const response = await spotifyApi.searchAlbums(query, { limit: 1 });

    if (response.body.albums && response.body.albums.items.length > 0) {
      const spotifyUrl = response.body.albums.items[0].external_urls.spotify;
      logger.info(
        CTX,
        `Found Spotify URL for ${albumName} by ${artistName}: ${spotifyUrl}`
      );
      return { spotifyUrl };
    } else {
      logger.info(
        CTX,
        `No Spotify URL found for ${albumName} by ${artistName}`
      );
      return { spotifyUrl: null };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error;
    logger.error(CTX, `Error searching for album on Spotify: ${errorMessage}`);
    // Potentially re-throw or return a structured error response
    // For now, returning null similar to album not found
    return { spotifyUrl: null };
  }
}

/**
 * Bulk searches for albums on Spotify.
 * Utilizes Redis MGET for efficient cache retrieval.
 *
 * @param {Array<{name: string, artistName: string, mbid: string}>} albums Array of albums to search.
 * @returns {Promise<Record<string, string | null>>} A map of mbid to Spotify URL.
 */
export async function searchAlbumsBulk(
  albums: { name: string; artistName: string; mbid: string }[]
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};
  if (albums.length === 0) return results;

  const notFoundRedisPlaceholder = 'SPOTIFY_NOT_FOUND';
  const defaultCacheExpiry = 86400; // 24 hours
  const defaultNotFoundCacheExpiry = 3600; // 1 hour

  // 1. Prepare cache keys
  const cacheEntries = albums.map((album) => ({
    mbid: album.mbid,
    key: `spotify:link:${encodeURIComponent(album.artistName)}:${encodeURIComponent(album.name)}`,
    album,
  }));
  const cacheKeys = cacheEntries.map((e) => e.key);

  // 2. MGET from Redis
  let cachedValues: (string | null)[] = [];
  try {
    cachedValues = await redis.mget(...cacheKeys);
  } catch (error) {
    logger.error(
      CTX,
      `Error during Redis MGET: ${error instanceof Error ? error.message : String(error)}`
    );
    cachedValues = new Array(cacheKeys.length).fill(null);
  }

  const missIndices: number[] = [];

  cachedValues.forEach((val, index) => {
    const { mbid } = cacheEntries[index];
    if (val === null) {
      missIndices.push(index);
    } else if (val === notFoundRedisPlaceholder) {
      results[mbid] = null;
    } else {
      try {
        const parsed = JSON.parse(val);
        results[mbid] = parsed.spotifyUrl || null;
      } catch (e) {
        // Fallback if not JSON or different structure
        results[mbid] = val;
      }
    }
  });

  if (missIndices.length === 0) {
    logger.info(CTX, `Bulk search: All ${albums.length} albums found in cache.`);
    return results;
  }

  logger.info(
    CTX,
    `Bulk search: Cache miss for ${missIndices.length}/${albums.length} albums, fetching from Spotify...`
  );

  // 3. Fetch misses
  try {
    await getAccessToken();
  } catch (e) {
    logger.error(CTX, `Failed to get access token for bulk search: ${e}`);
    missIndices.forEach((index) => {
      results[cacheEntries[index].mbid] = null;
    });
    return results;
  }

  const spotifyApi = getSpotifyApiInstance();

  const fetchPromises = missIndices.map(async (index) => {
    const { album, key, mbid } = cacheEntries[index];
    try {
      logger.info(
        CTX,
        `Bulk Search: Fetching fresh for ${album.name} by ${album.artistName}`
      );
      const query = `album:${album.name} artist:${album.artistName}`;
      const response = await spotifyApi.searchAlbums(query, { limit: 1 });

      let spotifyUrl: string | null = null;
      if (response.body.albums && response.body.albums.items.length > 0) {
        spotifyUrl = response.body.albums.items[0].external_urls.spotify;
      }

      results[mbid] = spotifyUrl;

      // Cache the result
      if (spotifyUrl) {
        await redis.setex(
          key,
          defaultCacheExpiry,
          JSON.stringify({ spotifyUrl })
        );
      } else {
        await redis.setex(
          key,
          defaultNotFoundCacheExpiry,
          notFoundRedisPlaceholder
        );
      }
    } catch (error) {
      logger.error(
        CTX,
        `Error searching for album ${album.name} in bulk: ${error instanceof Error ? error.message : String(error)}`
      );
      results[mbid] = null;
    }
  });

  await Promise.all(fetchPromises);

  return results;
}
