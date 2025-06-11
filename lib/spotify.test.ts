// lib/spotify.test.ts
import SpotifyWebApi from 'spotify-web-api-node'; // Will be the mock
import Redis from 'ioredis'; // Will be the mock
import {
  getUserAuthorizedSpotifyApi,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getAppAuthorizedSpotifyApi,
  // Import other functions to test if time permits, like specific API wrappers
  // For now, focusing on core auth and token logic
} from './spotify'; // Adjust path as necessary

// Get instances of the mocks
const mockSpotifyApiInstance = (SpotifyWebApi as any).mockInstance;
const mockRedisInstance = (Redis as any).mockInstance;

// Mock environment variables
const ORIGINAL_ENV = process.env;

describe('lib/spotify.ts', () => {
  beforeEach(() => {
    jest.resetModules(); // Clear module cache to reset SpotifyApi instance state if necessary
    process.env = {
      ...ORIGINAL_ENV,
      SPOTIFY_CLIENT_ID: 'test-client-id',
      SPOTIFY_CLIENT_SECRET: 'test-client-secret',
      SPOTIFY_REDIRECT_URI: 'http://localhost/callback',
    };

    // Reset all mock function calls and mock store states
    jest.clearAllMocks();
    mockRedisInstance.clear(); // Clear our mock Redis store
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV; // Restore original environment variables
  });

  describe('getUserAuthorizedSpotifyApi', () => {
    const sessionId = 'test-session';

    it('should return null if no tokens are found', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      const api = await getUserAuthorizedSpotifyApi(sessionId);
      expect(api).toBeNull();
      expect(mockRedisInstance.get).toHaveBeenCalledWith(`spotify_token:${sessionId}`);
    });

    it('should return an API client if valid tokens exist', async () => {
      const futureTime = Date.now() + 3600 * 1000;
      mockRedisInstance.get.mockResolvedValue(JSON.stringify({
        accessToken: 'valid-access-token',
        refreshToken: 'valid-refresh-token',
        expiresAt: futureTime,
      }));

      const api = await getUserAuthorizedSpotifyApi(sessionId);
      expect(api).not.toBeNull();
      expect(mockSpotifyApiInstance.setAccessToken).toHaveBeenCalledWith('valid-access-token');
      expect(mockSpotifyApiInstance.setRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
    });

    it('should refresh token if expired and succeed', async () => {
      const pastTime = Date.now() - 1000; // Expired
      mockRedisInstance.get.mockResolvedValueOnce(JSON.stringify({ // Initial load
        accessToken: 'expired-access-token',
        refreshToken: 'valid-refresh-token',
        expiresAt: pastTime,
      })).mockResolvedValueOnce(JSON.stringify({ // Load after refresh
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token', // Assuming refresh token might also be new
        expiresAt: Date.now() + 3600 * 1000,
      }));

      mockSpotifyApiInstance.refreshAccessToken.mockResolvedValue({
        body: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token', // Simulate Spotify returning a new refresh token
          expires_in: 3600,
        },
      });

      const api = await getUserAuthorizedSpotifyApi(sessionId);
      expect(api).not.toBeNull();
      expect(mockSpotifyApiInstance.refreshAccessToken).toHaveBeenCalled();
      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        `spotify_token:${sessionId}`,
        expect.stringContaining('new-access-token'), // Check that new token is stored
        'EX',
        expect.any(Number)
      );
      expect(mockSpotifyApiInstance.setAccessToken).toHaveBeenCalledWith('new-access-token');
      expect(mockSpotifyApiInstance.setRefreshToken).toHaveBeenCalledWith('new-refresh-token');
    });

    it('should return null if token refresh fails', async () => {
      const pastTime = Date.now() - 1000;
       mockRedisInstance.get.mockResolvedValue(JSON.stringify({
        accessToken: 'expired-access-token',
        refreshToken: 'valid-refresh-token',
        expiresAt: pastTime,
      }));
      mockSpotifyApiInstance.refreshAccessToken.mockRejectedValue(new Error('Refresh failed'));

      const api = await getUserAuthorizedSpotifyApi(sessionId);
      expect(api).toBeNull();
      expect(mockRedisInstance.del).toHaveBeenCalledWith(`spotify_token:${sessionId}`); // Ensure tokens are cleared on failure
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should return a valid authorization URL', () => {
      const state = 'test-state';
      mockSpotifyApiInstance.createAuthorizeURL.mockReturnValue('http://spotify.com/auth?state=test-state');
      const url = getAuthorizationUrl(state);
      expect(url).toBe('http://spotify.com/auth?state=test-state');
      expect(mockSpotifyApiInstance.createAuthorizeURL).toHaveBeenCalledWith(
        expect.arrayContaining(['playlist-modify-private']), // Check for some scopes
        state
      );
    });
  });

  describe('exchangeCodeForTokens', () => {
    const code = 'auth-code';
    const sessionId = 'test-session-for-exchange';

    it('should store tokens and return true on successful code exchange', async () => {
      mockSpotifyApiInstance.authorizationCodeGrant.mockResolvedValue({
        body: {
          access_token: 'exchanged-access-token',
          refresh_token: 'exchanged-refresh-token',
          expires_in: 3600,
        },
      });
      const result = await exchangeCodeForTokens(code, sessionId);
      expect(result).toBe(true);
      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        `spotify_token:${sessionId}`,
        expect.stringContaining('exchanged-access-token'),
        'EX',
        expect.any(Number)
      );
    });

    it('should return false on failed code exchange', async () => {
      mockSpotifyApiInstance.authorizationCodeGrant.mockRejectedValue(new Error('Exchange failed'));
      const result = await exchangeCodeForTokens(code, sessionId);
      expect(result).toBe(false);
      expect(mockRedisInstance.set).not.toHaveBeenCalled();
    });
  });

  describe('getAppAuthorizedSpotifyApi', () => {
    it('should fetch app token if none exists or expired, and return API client', async () => {
        mockSpotifyApiInstance.clientCredentialsGrant.mockResolvedValue({
            body: {
                access_token: 'app-access-token',
                expires_in: 3600,
            },
        });

        const api = await getAppAuthorizedSpotifyApi();
        expect(api).not.toBeNull();
        expect(mockSpotifyApiInstance.clientCredentialsGrant).toHaveBeenCalled();
        expect(mockSpotifyApiInstance.setAccessToken).toHaveBeenCalledWith('app-access-token');
    });

    it('should use cached app token if valid', async () => {
        // First call to cache the token
        mockSpotifyApiInstance.clientCredentialsGrant.mockResolvedValueOnce({
            body: { access_token: 'app-access-token-cached', expires_in: 3600 },
        });
        await getAppAuthorizedSpotifyApi();

        // Reset clientCredentialsGrant mock for the second call to ensure it's not called again
        mockSpotifyApiInstance.clientCredentialsGrant.mockClear();
        mockSpotifyApiInstance.setAccessToken.mockClear(); // Clear this too

        const api2 = await getAppAuthorizedSpotifyApi(); // Should use cached token
        expect(api2).not.toBeNull();
        expect(mockSpotifyApiInstance.clientCredentialsGrant).not.toHaveBeenCalled();
        expect(mockSpotifyApiInstance.setAccessToken).toHaveBeenCalledWith('app-access-token-cached');
    });

    it('should refresh app token if expired', async () => {
        // First call to set an "expired" token (by manipulating time or a very short expiry)
         mockSpotifyApiInstance.clientCredentialsGrant.mockResolvedValueOnce({
            body: { access_token: 'app-access-token-initial', expires_in: 0.1 }, // Expires almost immediately
        });
        await getAppAuthorizedSpotifyApi(); // Call to cache initial token

        // Second call, should trigger refresh
        mockSpotifyApiInstance.clientCredentialsGrant.mockResolvedValueOnce({
            body: { access_token: 'app-access-token-refreshed', expires_in: 3600 },
        });
        mockSpotifyApiInstance.setAccessToken.mockClear(); // Clear setAccessToken mock before second call

        const api2 = await getAppAuthorizedSpotifyApi();
        expect(api2).not.toBeNull();
        expect(mockSpotifyApiInstance.clientCredentialsGrant).toHaveBeenCalledTimes(1); // Called once for this specific "refresh" scenario after initial
        expect(mockSpotifyApiInstance.setAccessToken).toHaveBeenCalledWith('app-access-token-refreshed');
    });
  });
});
