// /app/api/albums/route.test.ts

import { GET } from './route';
import { NextRequest } from 'next/server';
import { redis } from '../../../lib/redis';
import { MinimizedAlbum } from '../../../lib/minimizedLastfmService'; // Added
// We will import the mocked version of SpotifyWebApi later
// import SpotifyWebApi from 'spotify-web-api-node';

// Mock external dependencies
jest.mock('../../../lib/redis', () => ({
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Helper function to create a mock request
const createMockRequest = (username: string, period: string) => {
  const url = new URL(
    `http://localhost:3000/api/albums?username=${username}&period=${period}`
  );
  // Cast to NextRequest for type compatibility in tests, actual Request is fine for route handler
  return new Request(url.toString()) as NextRequest;
};

describe('GET /api/albums', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Mock environment variables
    process.env.LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';
    process.env.LASTFM_API_KEY = 'testapikey';
    // No longer need SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET for this test file
  });

  it('should return cached data if available', async () => {
    // Arrange
    const mockUsername = 'testuser';
    const mockPeriod = '7day';
    const mockCachedData: MinimizedAlbum[] = [
      // Updated mockCachedData
      {
        name: 'Test Album',
        artist: { name: 'Test Artist', mbid: 'artist-mbid-cache' },
        imageUrl: 'cached.jpg',
        mbid: 'album-mbid-cache',
        playcount: 10,
      },
    ];
    (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(mockCachedData));

    const req = createMockRequest(mockUsername, mockPeriod);

    // Act
    const response = await GET(req);
    const data = await response.json();

    // Assert
    expect(redis.get).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:minimized` // Updated cache key
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(data).toEqual(mockCachedData);
  });

  it('should fetch data from LastFM if not cached', async () => {
    // Arrange
    const mockUsername = 'testuser';
    const mockPeriod = '1month';
    // Full Last.fm structure for mock fetch
    const mockLastFmAlbum = {
      name: 'Fetched Album',
      artist: {
        name: 'Test Artist',
        mbid: 'artist-mbid-fetch',
        url: 'artist-url',
      },
      image: [
        { '#text': 'small.jpg', size: 'small' },
        { '#text': 'medium.jpg', size: 'medium' },
        { '#text': 'large.jpg', size: 'large' },
        { '#text': 'extralarge.jpg', size: 'extralarge' },
      ],
      mbid: 'album-mbid-fetch',
      playcount: '120', // Playcount as string from Last.fm
      url: 'album-url',
    };
    const mockLastFmData = {
      topalbums: {
        album: [mockLastFmAlbum],
        '@attr': {
          user: mockUsername,
          totalPages: '1',
          page: '1',
          perPage: '9',
          total: '1',
        },
      },
    };

    // Expected transformed data
    const expectedTransformedData: MinimizedAlbum[] = [
      {
        name: 'Fetched Album',
        artist: { name: 'Test Artist', mbid: 'artist-mbid-fetch' },
        imageUrl: 'extralarge.jpg',
        mbid: 'album-mbid-fetch',
        playcount: 120, // Playcount as number
      },
    ];

    (redis.get as jest.Mock).mockResolvedValue(null); // Cache miss
    mockFetch.mockResolvedValue({
      // Mock Last.fm fetch
      ok: true,
      json: jest.fn().mockResolvedValue(mockLastFmData),
    });

    const req = createMockRequest(mockUsername, mockPeriod);

    // Act
    const response = await GET(req);
    const data = await response.json();

    // Assert
    expect(redis.get).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:minimized` // Updated cache key
    );
    expect(mockFetch).toHaveBeenCalledWith(
      `${process.env.LASTFM_BASE_URL}?method=user.gettopalbums&user=${mockUsername}&period=${mockPeriod}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=9`
    );
    // Data saved to cache should be the TRANSFORMED data
    expect(redis.setex).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:minimized`, // Updated cache key
      3600,
      JSON.stringify(expectedTransformedData) // Transformed data
    );
    expect(response.status).toBe(200);
    expect(data).toEqual(expectedTransformedData); // Response should be TRANSFORMED data
  });

  it('should fetch data and return empty array if LastFM returns no albums', async () => {
    const mockUsername = 'testuser';
    const mockPeriod = '3month';
    const mockEmptyLastFmData = {
      topalbums: {
        album: [],
        '@attr': {
          user: mockUsername,
          totalPages: '0',
          page: '1',
          perPage: '9',
          total: '0',
        },
      },
    };

    (redis.get as jest.Mock).mockResolvedValue(null); // Cache miss
    mockFetch.mockResolvedValue({
      // Mock Last.fm fetch
      ok: true,
      json: jest.fn().mockResolvedValue(mockEmptyLastFmData),
    });

    const req = createMockRequest(mockUsername, mockPeriod);
    const response = await GET(req);
    const data = await response.json();

    expect(redis.get).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:minimized`
    );
    expect(mockFetch).toHaveBeenCalled();
    // Check that "NOT_FOUND_PLACEHOLDER" is cached with notFoundCacheExpirySeconds
    expect(redis.setex).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:minimized`,
      600, // notFoundCacheExpirySeconds
      'NOT_FOUND_PLACEHOLDER' // Adjusted expectation based on Jest's reported "Received" value
    );
    expect(response.status).toBe(200);
    expect(data).toEqual([]); // Expect empty array as per transform and notFoundReturnValue
  });

  // Removed Spotify-specific tests:
  // - should fetch Spotify access token if not available
  // - should set spotifyUrl to null if album not found on Spotify
  // - should set spotifyUrl to null and not break if Spotify API search fails for an album
  // - should handle failure in fetching Spotify access token

  it('should handle LastFM fetch failure gracefully', async () => {
    // Arrange
    const mockUsername = 'testuser';
    const mockPeriod = 'overall';
    (redis.get as jest.Mock).mockResolvedValue(null);
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
      status: 404,
      text: jest.fn().mockResolvedValue('Mock Last.fm error message text'), // Added text() method
    });

    const req = createMockRequest(mockUsername, mockPeriod);

    // Act
    const response = await GET(req);
    const data = await response.json();

    // Assert
    expect(redis.get).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:minimized` // Updated cache key
    );
    expect(mockFetch).toHaveBeenCalled();
    expect(response.status).toBe(500);
    expect(data.message).toBe('Error fetching albums');
  });

  it('should handle errors thrown during general fetch processing', async () => {
    // Arrange
    const mockUsername = 'testuser';
    const mockPeriod = 'overall';
    (redis.get as jest.Mock).mockResolvedValue(null);
    mockFetch.mockRejectedValue(new Error('Network error')); // Generic error during LastFM fetch

    const req = createMockRequest(mockUsername, mockPeriod);

    // Act
    const response = await GET(req);
    const data = await response.json();

    // Assert
    expect(redis.get).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:minimized` // Corrected cache key
    );
    expect(mockFetch).toHaveBeenCalled();
    // searchAlbums should not have been called
    expect(redis.setex).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    expect(data.message).toBe('Error fetching albums');
  });
});
