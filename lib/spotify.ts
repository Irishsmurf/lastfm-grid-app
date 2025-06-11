// lib/spotify.ts
import SpotifyWebApi from 'spotify-web-api-node';
import { redis } from '@/lib/redis';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REDIRECT_URI) {
  throw new Error('Spotify API credentials or redirect URI are not configured in environment variables.');
}

interface UserSpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Timestamp in milliseconds
}

const spotifyApi = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET,
  redirectUri: SPOTIFY_REDIRECT_URI,
});

// --- Token Management ---

async function storeUserTokens(sessionId: string, accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
  const tokenData: UserSpotifyTokens = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000 - (5 * 60 * 1000), // Store with a 5-min buffer
  };
  // Store in Redis. expiresIn is in seconds.
  // We'll use a longer Redis expiry for the record itself, as the refresh token doesn't expire.
  // The accessToken's actual expiry is tracked by 'expiresAt'.
  await redis.set(\`spotify_token:\${sessionId}\`, JSON.stringify(tokenData), 'EX', 30 * 24 * 60 * 60); // Store for 30 days
  console.log(\`[Spotify Service] Tokens stored for session: \${sessionId}\`);
}

async function getUserTokens(sessionId: string): Promise<UserSpotifyTokens | null> {
  const tokenDataString = await redis.get(\`spotify_token:\${sessionId}\`);
  if (tokenDataString) {
    return JSON.parse(tokenDataString) as UserSpotifyTokens;
  }
  return null;
}

async function clearUserTokens(sessionId: string): Promise<void> {
  await redis.del(\`spotify_token:\${sessionId}\`);
  console.log(\`[Spotify Service] Tokens cleared for session: \${sessionId}\`);
}

// --- Spotify API Client Initialization ---

/**
 * Returns a Spotify API client instance configured with the user's access token.
 * Handles token refresh if necessary.
 * @param sessionId The user's session identifier.
 * @returns A configured SpotifyWebApi instance or null if tokens are invalid/not found.
 */
export async function getUserAuthorizedSpotifyApi(sessionId: string): Promise<SpotifyWebApi | null> {
  let tokens = await getUserTokens(sessionId);

  if (!tokens) {
    console.log(\`[Spotify Service] No tokens found for session: \${sessionId}\`);
    return null; // No tokens, user needs to authorize
  }

  const now = Date.now();
  if (now >= tokens.expiresAt) {
    console.log(\`[Spotify Service] Access token for session \${sessionId} expired. Refreshing...\`);
    spotifyApi.setAccessToken(tokens.accessToken); // Set old access token
    spotifyApi.setRefreshToken(tokens.refreshToken);
    try {
      const data = await spotifyApi.refreshAccessToken();
      const newAccessToken = data.body['access_token'];
      const newExpiresIn = data.body['expires_in'];
      // Spotify might also return a new refresh token in some cases
      const newRefreshToken = data.body['refresh_token'] || tokens.refreshToken;

      spotifyApi.setAccessToken(newAccessToken);
      // The refresh token might or might not be returned. If it is, use the new one.
      if (data.body['refresh_token']) {
        spotifyApi.setRefreshToken(data.body['refresh_token']);
      }

      await storeUserTokens(sessionId, newAccessToken, newRefreshToken, newExpiresIn);
      tokens = await getUserTokens(sessionId); // reload tokens
      if (!tokens) { // Should not happen if storeUserTokens is correct
          console.error("[Spotify Service] Failed to reload tokens after refresh.");
          return null;
      }
      console.log(\`[Spotify Service] Access token for session \${sessionId} refreshed successfully.\`);
    } catch (error) {
      console.error(\`[Spotify Service] Error refreshing access token for session \${sessionId}:\`, error);
      // If refresh fails (e.g., refresh token revoked), clear tokens and require re-authorization
      await clearUserTokens(sessionId);
      return null;
    }
  }

  // Create a new instance or reconfigure the global one for this user
  // For safety, creating a new instance per user call might be better if not managing state carefully
  // However, spotify-web-api-node is designed to have tokens set per instance.
  // Re-using the global `spotifyApi` instance and setting its tokens for each call.
  spotifyApi.setAccessToken(tokens.accessToken);
  spotifyApi.setRefreshToken(tokens.refreshToken); // Good practice to set both
  return spotifyApi;
}

// --- Authorization Flow ---

export function getAuthorizationUrl(state: string): string {
  const scopes = ['playlist-modify-private', 'playlist-modify-public', 'user-read-private', 'user-read-email'];
  // Re-initialize a clean spotifyApi instance for creating authorize URL to avoid state leakage
  const authInstance = new SpotifyWebApi({
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET,
    redirectUri: SPOTIFY_REDIRECT_URI,
  });
  return authInstance.createAuthorizeURL(scopes, state);
}

export async function exchangeCodeForTokens(code: string, sessionId: string): Promise<boolean> {
  try {
    // Re-initialize a clean spotifyApi instance for code exchange
     const exchangeInstance = new SpotifyWebApi({
        clientId: SPOTIFY_CLIENT_ID,
        clientSecret: SPOTIFY_CLIENT_SECRET,
        redirectUri: SPOTIFY_REDIRECT_URI,
    });
    const data = await exchangeInstance.authorizationCodeGrant(code);
    const { access_token, refresh_token, expires_in } = data.body;
    await storeUserTokens(sessionId, access_token, refresh_token, expires_in);
    console.log(\`[Spotify Service] Code exchanged for tokens for session: \${sessionId}\`);
    return true;
  } catch (error) {
    console.error(\`[Spotify Service] Error exchanging code for tokens for session \${sessionId}:\`, error);
    return false;
  }
}

// --- Spotify API Actions ---
// These functions will use the getUserAuthorizedSpotifyApi to get a client

/**
 * Searches for albums on Spotify.
 * This particular search function might not require user auth if it's just general catalog search.
 * For simplicity, we'll assume it could be used with a client-credentials authed client in other contexts,
 * but here we'll tie it to user context if needed, or make a separate client-credentials based one.
 */
export async function searchAlbums(apiInstance: SpotifyWebApi, albumName: string, artistName: string, limit: number = 1) {
    // This uses the passed apiInstance, which should be authorized
    const query = \`album:\${albumName} artist:\${artistName}\`;
    return apiInstance.searchAlbums(query, { limit });
}

export async function getAlbumTracks(apiInstance: SpotifyWebApi, albumId: string, limit: number = 50) {
    return apiInstance.getAlbumTracks(albumId, { limit });
}

/**
 * Fetches full track details for multiple tracks to get their popularity.
 * @param trackIds Array of track IDs.
 */
export async function getTracksDetails(apiInstance: SpotifyWebApi, trackIds: string[]) {
    if (trackIds.length === 0) return [];
    // The getTracks method takes an array of track IDs. Max 50 per call.
    const responses = [];
    for (let i = 0; i < trackIds.length; i += 50) {
        const batch = trackIds.slice(i, i + 50);
        const response = await apiInstance.getTracks(batch);
        responses.push(...response.body.tracks);
    }
    return responses;
}


export async function getCurrentUserProfile(apiInstance: SpotifyWebApi) {
    return apiInstance.getMe();
}

export async function createPlaylist(apiInstance: SpotifyWebApi, userId: string, name: string, description: string, isPublic: boolean = false) {
    return apiInstance.createPlaylist(userId, name, { description, public: isPublic });
}

export async function addTracksToPlaylist(apiInstance: SpotifyWebApi, playlistId: string, trackUris: string[]) {
    if (trackUris.length === 0) return null;
    // Max 100 tracks per call
    const responses = [];
    for (let i = 0; i < trackUris.length; i += 100) {
        const batch = trackUris.slice(i, i + 100);
        const response = await apiInstance.addTracksToPlaylist(playlistId, batch);
        responses.push(response); // Store response for each batch call if needed
    }
    return responses.length > 0 ? responses[responses.length-1] : null; // Return the last response
}

// --- Client Credentials Grant (for non-user specific calls if needed in future) ---
let appAccessToken: string | null = null;
let appTokenExpiryTime: number = 0;

async function refreshAppAccessToken() {
  try {
    const clientCredentialsApi = new SpotifyWebApi({
        clientId: SPOTIFY_CLIENT_ID,
        clientSecret: SPOTIFY_CLIENT_SECRET,
    });
    const data = await clientCredentialsApi.clientCredentialsGrant();
    appAccessToken = data.body['access_token'];
    appTokenExpiryTime = Date.now() + data.body['expires_in'] * 1000 - (5 * 60 * 1000); // 5 min buffer
    console.log('[Spotify Service] Application access token refreshed.');
  } catch (error) {
    console.error('[Spotify Service] Error refreshing application access token:', error);
    appAccessToken = null;
    appTokenExpiryTime = 0;
    throw new Error('Failed to refresh Spotify application access token.');
  }
}

/**
 * Returns a Spotify API client instance configured with an application access token (Client Credentials Flow).
 * Handles token refresh if necessary. Useful for accessing public Spotify data not tied to a user.
 */
export async function getAppAuthorizedSpotifyApi(): Promise<SpotifyWebApi> {
  if (!appAccessToken || Date.now() >= appTokenExpiryTime) {
    await refreshAppAccessToken();
  }
  const appApiInstance = new SpotifyWebApi({ clientId: SPOTIFY_CLIENT_ID }); // Can't set client secret after instantiation
  appApiInstance.setAccessToken(appAccessToken);
  return appApiInstance;
}

/**
 * Example: Search for an album using client credentials (public data)
 * This is separate from the user-context searchAlbums defined earlier.
 */
export async function searchPublicAlbums(albumName: string, artistName: string, limit: number = 1) {
    const publicApi = await getAppAuthorizedSpotifyApi();
    const query = \`album:\${albumName} artist:\${artistName}\`;
    return publicApi.searchAlbums(query, { limit });
}
