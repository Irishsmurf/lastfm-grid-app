import { redis } from '@/lib/redis';
import { logger } from '@/utils/logger';

const CTX = 'SpotifyService';
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_ACCESS_TOKEN_REDIS_KEY = 'spotify:accessToken';

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
