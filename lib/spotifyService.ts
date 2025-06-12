import SpotifyWebApi from 'spotify-web-api-node';
import { redis } from '@/lib/redis';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_ACCESS_TOKEN_REDIS_KEY = 'spotify:accessToken';

// Removed top-level check and spotifyApi instantiation

let spotifyApiInstance: SpotifyWebApi | null = null;

function getSpotifyApiInstance(): SpotifyWebApi {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
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
    console.log('Spotify access token refreshed and stored in Redis.');
    return accessToken;
  } catch (error) {
    console.error('Error refreshing Spotify access token:', error);
    throw new Error('Failed to refresh Spotify access token');
  }
}

async function getAccessToken(): Promise<string> {
  const spotifyApi = getSpotifyApiInstance();
  let token = await redis.get(SPOTIFY_ACCESS_TOKEN_REDIS_KEY);
  if (!token) {
    console.log(
      'Spotify access token not found in Redis or expired, refreshing...'
    );
    token = await refreshSpotifyToken(); // This will also call getSpotifyApiInstance
  } else {
    spotifyApi.setAccessToken(token); // Sets on the singleton instance
    console.log('Spotify access token retrieved from Redis.');
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
  try {
    await getAccessToken(); // This ensures the token is set on the shared instance
    const query = `album:${albumName} artist:${artistName}`;
    const response = await spotifyApi.searchAlbums(query, { limit: 1 });

    if (response.body.albums && response.body.albums.items.length > 0) {
      return {
        spotifyUrl: response.body.albums.items[0].external_urls.spotify,
      };
    } else {
      return { spotifyUrl: null };
    }
  } catch (error) {
    console.error('Error searching for album on Spotify:', error);
    // Potentially re-throw or return a structured error response
    // For now, returning null similar to album not found
    return { spotifyUrl: null };
  }
}

// Export any other functions if needed, for now only searchAlbum
// export { getAccessToken, refreshSpotifyToken };
