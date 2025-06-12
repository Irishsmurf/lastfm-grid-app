import SpotifyWebApi from 'spotify-web-api-node';
import { redis } from '@/lib/redis';
import logger from '../utils/logger';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_ACCESS_TOKEN_REDIS_KEY = 'spotify:accessToken';

// Removed top-level check and spotifyApi instantiation

let spotifyApiInstance: SpotifyWebApi | null = null;

function getSpotifyApiInstance(): SpotifyWebApi {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    logger.error(
      'lib/spotifyService.ts',
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
    logger.info(
      'lib/spotifyService.ts',
      'Spotify access token refreshed and stored in Redis.'
    );
    return accessToken;
  } catch (error) {
    logger.error(
      'lib/spotifyService.ts',
      `Error refreshing Spotify access token: ${error}`
    );
    throw new Error('Failed to refresh Spotify access token');
  }
}

async function getAccessToken(): Promise<string> {
  const spotifyApi = getSpotifyApiInstance();
  let token = await redis.get(SPOTIFY_ACCESS_TOKEN_REDIS_KEY);
  if (!token) {
    logger.info(
      'lib/spotifyService.ts',
      'Spotify access token not found in Redis or expired, refreshing...'
    );
    token = await refreshSpotifyToken();
  } else {
    spotifyApi.setAccessToken(token); // Sets on the singleton instance
    logger.info(
      'lib/spotifyService.ts',
      'Spotify access token retrieved from Redis.'
    );
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
    'lib/spotifyService.ts',
    `Searching for album on Spotify: ${albumName} by ${artistName}`
  );
  try {
    await getAccessToken(); // This ensures the token is set on the shared instance
    const query = `album:${albumName} artist:${artistName}`;
    const response = await spotifyApi.searchAlbums(query, { limit: 1 });

    if (response.body.albums && response.body.albums.items.length > 0) {
      const spotifyUrl = response.body.albums.items[0].external_urls.spotify;
      logger.info(
        'lib/spotifyService.ts',
        `Found Spotify URL for ${albumName} by ${artistName}: ${spotifyUrl}`
      );
      return { spotifyUrl };
    } else {
      logger.info(
        'lib/spotifyService.ts',
        `No Spotify URL found for ${albumName} by ${artistName}`
      );
      return { spotifyUrl: null };
    }
  } catch (error) {
    logger.error(
      'lib/spotifyService.ts',
      `Error searching for album on Spotify: ${error}`
    );
    // Potentially re-throw or return a structured error response
    // For now, returning null similar to album not found
    return { spotifyUrl: null };
  }
}
