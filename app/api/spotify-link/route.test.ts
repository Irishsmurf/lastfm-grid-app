// app/api/spotify-link/route.test.ts

import { GET } from './route';
import { NextRequest } from 'next/server';

// Define types for Spotify API responses for better type safety in mocks
interface SpotifyAlbumItem {
  external_urls: { spotify: string };
  name: string;
}
type SpotifySearchResponse = { body: { albums?: { items: SpotifyAlbumItem[] } } };
type SpotifyClientCredentialsGrantResponse = { body: { 'access_token': string; expires_in?: number } };
type SpotifySearchOptions = Record<string, unknown>;

// jest.setup.ts initializes global.__spotifyMockControls
// We need to mock spotify-web-api-node here to use those controls.
jest.mock('spotify-web-api-node', () => {
  return jest.fn().mockImplementation(() => ({
    searchAlbums: jest.fn((_query: string, _options?: SpotifySearchOptions) => {
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
  beforeEach(() => {
    jest.useRealTimers(); // Use real timers by default for all tests
    // Reset mock controls to defaults
    globalThis.__spotifyMockControls = {
      searchAlbumsResult: { body: { albums: { items: [] } } },
      // Ensure expires_in is part of the default success mock for clientCredentialsGrantResult
      clientCredentialsGrantResult: { body: { 'access_token': 'mock-access-token', 'expires_in': 3600 } },
      getAccessTokenValue: 'mock-access-token',
    };

    // Mock environment variables for Spotify
    process.env.SPOTIFY_CLIENT_ID = 'test-spotify-client-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'test-spotify-client-secret';
  });

  it('should return Spotify URL when album is found', async () => {
    const albumName = 'Test Album';
    const artistName = 'Test Artist';
    const expectedSpotifyUrl = 'http://spotify.com/album/test';

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
  });

  it('should return null for spotifyUrl when album is not found', async () => {
    const albumName = 'Unknown Album';
    const artistName = 'Unknown Artist';

    globalThis.__spotifyMockControls.searchAlbumsResult = { body: { albums: { items: [] } } }; // Ensure it's empty

    const req = createMockSpotifyRequest(albumName, artistName);
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.spotifyUrl).toBeNull();
    expect(data.message).toBe('Album not found on Spotify');
  });

  it('should return 400 if albumName parameter is missing', async () => {
    const req = createMockSpotifyRequest(undefined, 'Test Artist');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Missing required query parameters: albumName and artistName');
  });

  it('should return 400 if artistName parameter is missing', async () => {
    const req = createMockSpotifyRequest('Test Album', undefined);
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Missing required query parameters: albumName and artistName');
  });

  it('should handle Spotify API authentication error (token grant failure)', async () => {
    jest.resetModules(); // Reset module cache to ensure clean state for route's internal token

    // Re-mock environment variables for this specific test context as resetModules clears them for the module
    process.env.SPOTIFY_CLIENT_ID = 'test-spotify-client-id-for-auth-fail';
    process.env.SPOTIFY_CLIENT_SECRET = 'test-spotify-client-secret-for-auth-fail';

    // Re-import the GET handler from the reset module
    const { GET: GET_handler_for_test } = await import('./route');

    // Set conditions for clientCredentialsGrant to fail
    // global.__spotifyMockControls is initialized in jest.setup.ts,
    // but we might need to ensure its state if other tests modified it and ran before this.
    // However, beforeEach should handle resetting global.__spotifyMockControls.
    globalThis.__spotifyMockControls.clientCredentialsGrantResult = new Error('Spotify Auth Failed');
    // Setting getAccessTokenValue to null ensures the first path of getValidAccessToken is taken
    // if by any chance route's internal accessToken was not reset by resetModules (it should be).
    globalThis.__spotifyMockControls.getAccessTokenValue = null;

    const req = createMockSpotifyRequest('Test Album', 'Test Artist');
    const response = await GET_handler_for_test(req); // Use the re-imported handler
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.message).toBe('Error with Spotify authentication. Please try again.');
    expect(data.error).toBe('AUTH_TOKEN_REFRESH_FAILED_SPOTIFY');
  });

  it('should handle Spotify searchAlbums API error', async () => {
    globalThis.__spotifyMockControls.searchAlbumsResult = new Error('Spotify API Search Error');

    const req = createMockSpotifyRequest('Test Album', 'Test Artist');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain('Internal Server Error');
    expect(data.error).toBe('Spotify API Search Error');
  });

  it('should refresh token if initial getAccessToken returns null', async () => {
    const albumName = 'Test Album Refresh';
    const artistName = 'Test Artist Refresh';
    const expectedSpotifyUrl = 'http://spotify.com/album/refresh';

    // Setup: First call to getAccessToken returns null, then a valid token after refresh
    globalThis.__spotifyMockControls.getAccessTokenValue = null;
    globalThis.__spotifyMockControls.clientCredentialsGrantResult = { body: { 'access_token': 'new-refreshed-token' }};
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
    // Implicitly, clientCredentialsGrant was called.
    // To make this test more robust, we'd ideally check if clientCredentialsGrant was called.
    // This requires the mock setup to allow spying, which the current global one makes harder.
    // For now, the successful outcome implies token refresh.
    // No need to manage timers here if not specifically testing expiry
  });
});
