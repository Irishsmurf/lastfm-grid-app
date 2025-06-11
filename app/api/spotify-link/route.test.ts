// app/api/spotify-link/route.test.ts

import { GET } from './route';
import { NextRequest } from 'next/server';
import SpotifyWebApi from 'spotify-web-api-node'; // Import the actual module

// Define mock functions for Redis BEFORE jest.mock call
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();

// Mock Redis client
jest.mock('@/lib/redis', () => {
  // Note: The actual redis export from '@/lib/redis' is an ioredis instance, not an object like { redis: { get, set } }.
  // The mock should match the actual module structure.
  // If the actual module is `export const redis = new Redis(...)`, then the mock should be:
  // return { __esModule: true, redis: { get: mockRedisGet, set: mockRedisSet } };
  // However, the original code was `import { redis } from '@/lib/redis'`, implying redis is a named export.
  // Let's assume the original mock structure was trying to mock the methods of the `redis` named export.
  return {
    __esModule: true,
    redis: {
      get: mockRedisGet,
      set: mockRedisSet,
    }
  };
});

// Types for Spotify API responses are defined in jest.setup.ts via declare global for __spotifyMockControls
// Or they can be defined here if needed for local variable typing.
// For now, remove unused local types if global ones are sufficient.

// jest.setup.ts initializes global.__spotifyMockControls
// We need to mock spotify-web-api-node here to use those controls.

// Define a type for Spotify search options if needed, or use Record<string, unknown>
type SpotifySearchOptions = Record<string, unknown>; // This might still be used by the mock function signature

jest.mock('spotify-web-api-node', () => {
  return jest.fn().mockImplementation(() => ({
    searchAlbums: jest.fn((_query: string, _options?: SpotifySearchOptions) => { // SpotifySearchOptions is used here
      if (globalThis.__spotifyMockControls.searchAlbumsResult instanceof Error) {
        return Promise.reject(globalThis.__spotifyMockControls.searchAlbumsResult);
      }
      return Promise.resolve(globalThis.__spotifyMockControls.searchAlbumsResult);
    }),
    clientCredentialsGrant: jest.fn(() => {
      if (globalThis.__spotifyMockControls.clientCredentialsGrantResult instanceof Error) {
        return Promise.reject(globalThis.__spotifyMockControls.clientCredentialsGrantResult);
      }
      return Promise.resolve(globalThis.__spotifyMockControls.clientCredentialsGrantResult);
    }),
    setAccessToken: jest.fn((_token: string) => {}),
    getAccessToken: jest.fn(() => globalThis.__spotifyMockControls.getAccessTokenValue),
  }));
});


// Helper function to create a mock request for this endpoint
const createMockSpotifyRequest = (albumName?: string, artistName?: string) => {
  let url = 'http://localhost:3000/api/spotify-link';
  const params = new URLSearchParams();
  if (albumName) params.append('albumName', albumName);
  if (artistName) params.append('artistName', artistName);
  if (params.toString()) {
    url += `?${params.toString()}`;
  }
  return new Request(url.toString()) as NextRequest;
};

describe('GET /api/spotify-link', () => {
  let spotifySearchAlbumsMock: jest.Mock;

  beforeEach(() => {
    jest.useRealTimers(); // Use real timers by default for all tests
    // Reset mock controls to defaults
    globalThis.__spotifyMockControls = {
      searchAlbumsResult: { body: { albums: { items: [] } } },
      // Ensure expires_in is part of the default success mock for clientCredentialsGrantResult
      clientCredentialsGrantResult: { body: { 'access_token': 'mock-access-token', 'expires_in': 3600 } },
      getAccessTokenValue: 'mock-access-token',
    };

    // Reset Redis mocks
    mockRedisGet.mockReset();
    mockRedisSet.mockReset();

    // Mock environment variables for Spotify
    process.env.SPOTIFY_CLIENT_ID = 'test-spotify-client-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'test-spotify-client-secret';

    // Get a reference to the mock function for spotifyApi.searchAlbums
    // SpotifyWebApi is now imported, and its constructor is mocked by jest.mock at the top.
    const spotifyApiInstance = new SpotifyWebApi(); // This instance will use the mocked methods
    spotifySearchAlbumsMock = spotifyApiInstance.searchAlbums as jest.Mock;
    spotifySearchAlbumsMock.mockClear();

    // Similarly, ensure clientCredentialsGrant can be accessed and cleared if needed for other tests
    // (though it's typically only called once per logical flow being tested)
    const clientCredentialsGrantMock = spotifyApiInstance.clientCredentialsGrant as jest.Mock;
    clientCredentialsGrantMock.mockClear();
  });

  it('should return Spotify URL when album is found and cache it', async () => {
    const albumName = 'Test Album';
    const artistName = 'Test Artist';
    const expectedSpotifyUrl = 'http://spotify.com/album/test';
    const cacheKey = `spotify-link:${artistName}:${albumName}`;

    mockRedisGet.mockResolvedValue(null); // Cache miss
    globalThis.__spotifyMockControls.searchAlbumsResult = {
      body: {
        albums: {
          items: [{ external_urls: { spotify: expectedSpotifyUrl }, name: albumName }],
        },
      },
    };

    const req = createMockSpotifyRequest(albumName, artistName);
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.spotifyUrl).toBe(expectedSpotifyUrl);
    expect(mockRedisGet).toHaveBeenCalledWith(cacheKey);
    expect(spotifySearchAlbumsMock).toHaveBeenCalledTimes(1);
    expect(mockRedisSet).toHaveBeenCalledWith(cacheKey, expectedSpotifyUrl, { ex: 86400 });
  });

  it('should return cached Spotify URL when album is found in cache', async () => {
    const albumName = 'Cached Album';
    const artistName = 'Cached Artist';
    const cachedSpotifyUrl = 'http://spotify.com/album/cached';
    const cacheKey = `spotify-link:${artistName}:${albumName}`;

    mockRedisGet.mockResolvedValue(cachedSpotifyUrl); // Cache hit

    const req = createMockSpotifyRequest(albumName, artistName);
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.spotifyUrl).toBe(cachedSpotifyUrl);
    expect(mockRedisGet).toHaveBeenCalledWith(cacheKey);
    expect(spotifySearchAlbumsMock).not.toHaveBeenCalled();
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it('should return null for spotifyUrl and cache "SPOTIFY_NOT_FOUND" when album is not found via API', async () => {
    const albumName = 'Unknown Album';
    const artistName = 'Unknown Artist';
    const cacheKey = `spotify-link:${artistName}:${albumName}`;

    mockRedisGet.mockResolvedValue(null); // Cache miss
    globalThis.__spotifyMockControls.searchAlbumsResult = { body: { albums: { items: [] } } };

    const req = createMockSpotifyRequest(albumName, artistName);
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.spotifyUrl).toBeNull();
    expect(data.message).toBe('Album not found on Spotify');
    expect(mockRedisGet).toHaveBeenCalledWith(cacheKey);
    expect(spotifySearchAlbumsMock).toHaveBeenCalledTimes(1);
    expect(mockRedisSet).toHaveBeenCalledWith(cacheKey, "SPOTIFY_NOT_FOUND", { ex: 3600 });
  });

  it('should return "Album not found on Spotify (cached)" when "SPOTIFY_NOT_FOUND" is cached', async () => {
    const albumName = 'Cached Not Found Album';
    const artistName = 'Cached Not Found Artist';
    const cacheKey = `spotify-link:${artistName}:${albumName}`;

    mockRedisGet.mockResolvedValue("SPOTIFY_NOT_FOUND"); // Cache hit for "not found"

    const req = createMockSpotifyRequest(albumName, artistName);
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.spotifyUrl).toBeNull();
    expect(data.message).toBe('Album not found on Spotify (cached)');
    expect(mockRedisGet).toHaveBeenCalledWith(cacheKey);
    expect(spotifySearchAlbumsMock).not.toHaveBeenCalled();
    expect(mockRedisSet).not.toHaveBeenCalled();
  });


  it('should return 400 if albumName parameter is missing', async () => {
    const req = createMockSpotifyRequest(undefined, 'Test Artist');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Missing required query parameters: albumName and artistName');
    expect(mockRedisGet).not.toHaveBeenCalled(); // Should not attempt cache lookup
  });

  it('should return 400 if artistName parameter is missing', async () => {
    const req = createMockSpotifyRequest('Test Album', undefined);
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Missing required query parameters: albumName and artistName');
    expect(mockRedisGet).not.toHaveBeenCalled(); // Should not attempt cache lookup
  });

  // For API error tests, we need to ensure a cache miss occurs first
  it('should handle Spotify API authentication error (token grant failure) after cache miss', async () => {
    const albumName = 'AuthFail Album';
    const artistName = 'AuthFail Artist';
    const cacheKey = `spotify-link:${artistName}:${albumName}`;
    mockRedisGet.mockResolvedValue(null); // Cache miss

    // Temporarily store original env vars and reset them for this test
    // This is because jest.resetModules() is tricky with module-level state like the token
    // and the GET function itself. We want to test the *current* GET function.
    const originalClientId = process.env.SPOTIFY_CLIENT_ID;
    const originalClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    process.env.SPOTIFY_CLIENT_ID = 'auth-fail-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'auth-fail-secret';

    // Reset the internal token state of the *already imported* GET function.
    // This is a bit of a workaround. Ideally, the token logic would be more easily testable/resettable.
    // For now, we make clientCredentialsGrant fail and ensure getAccessTokenValue is null.
    // We also need to re-import route to reset its internal token variable state
    // This is problematic because the top-level `GET` is already imported.
    // A better approach might be to refactor token management out or make it resettable.
    // Given the current structure, we'll assume a cache miss and then the token refresh fails.

    globalThis.__spotifyMockControls.clientCredentialsGrantResult = new Error('Spotify Auth Failed');
    globalThis.__spotifyMockControls.getAccessTokenValue = null; // Simulate expired or no token


    // Need to use a fresh import of GET for this test if we want to test module internal state reset
    // However, jest.resetModules() was causing issues with other mocks.
    // Let's try to make the existing GET fail by controlling its dependencies.
    // The key is that refreshSpotifyToken within route.ts will be called and will throw.

    const req = createMockSpotifyRequest(albumName, artistName);
    const response = await GET(req); // Use the standard GET
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.message).toBe('Error with Spotify authentication. Please try again.');
    expect(data.error).toBe('AUTH_TOKEN_REFRESH_FAILED_SPOTIFY');
    expect(mockRedisGet).toHaveBeenCalledWith(cacheKey);
    expect(mockRedisSet).not.toHaveBeenCalled(); // Should not cache on auth error

    // Restore original env vars
    process.env.SPOTIFY_CLIENT_ID = originalClientId;
    process.env.SPOTIFY_CLIENT_SECRET = originalClientSecret;
  });

  it('should handle Spotify searchAlbums API error after cache miss', async () => {
    const albumName = 'ApiError Album';
    const artistName = 'ApiError Artist';
    const cacheKey = `spotify-link:${artistName}:${albumName}`;
    mockRedisGet.mockResolvedValue(null); // Cache miss

    globalThis.__spotifyMockControls.searchAlbumsResult = new Error('Spotify API Search Error');

    const req = createMockSpotifyRequest(albumName, artistName);
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain('Internal Server Error while fetching Spotify link.');
    expect(data.error).toBe('Spotify API Search Error');
    expect(mockRedisGet).toHaveBeenCalledWith(cacheKey);
    expect(mockRedisSet).not.toHaveBeenCalled(); // Should not cache on API error
  });

  it('should refresh token if initial getAccessToken returns null, after cache miss', async () => {
    const albumName = 'Test Album Refresh';
    const artistName = 'Test Artist Refresh';
    const expectedSpotifyUrl = 'http://spotify.com/album/refresh';
    const cacheKey = `spotify-link:${artistName}:${albumName}`;

    mockRedisGet.mockResolvedValue(null); // Cache miss

    // Setup: First call to getAccessToken returns null, then a valid token after refresh
    globalThis.__spotifyMockControls.getAccessTokenValue = null; // Simulate token needs refresh
    globalThis.__spotifyMockControls.clientCredentialsGrantResult = { body: { 'access_token': 'new-refreshed-token', 'expires_in': 3600 }};
    globalThis.__spotifyMockControls.searchAlbumsResult = {
      body: {
        albums: {
          items: [{ external_urls: { spotify: expectedSpotifyUrl }, name: albumName }],
        },
      },
    };
    // Access the mock for clientCredentialsGrant via an instance from the imported & mocked SpotifyWebApi
    const spotifyApiInstance = new SpotifyWebApi(); // Instance uses mocked methods
    const clientCredentialsGrantMock = spotifyApiInstance.clientCredentialsGrant as jest.Mock;
    // No need to clear here if it's the first call in this test logic,
    // but if there were prior calls in the same test, clearing would be important.
    // beforeEach already clears it for a new test.

    const req = createMockSpotifyRequest(albumName, artistName);
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.spotifyUrl).toBe(expectedSpotifyUrl);
    expect(mockRedisGet).toHaveBeenCalledWith(cacheKey);
    expect(clientCredentialsGrantMock).toHaveBeenCalledTimes(1); // Verify token refresh occurred
    expect(mockRedisSet).toHaveBeenCalledWith(cacheKey, expectedSpotifyUrl, { ex: 86400 }); // Should cache after successful fetch
  });
});
