// /app/api/albums/route.test.ts

import { GET } from './route';
import { NextRequest } from 'next/server';
import { redis } from '../../../lib/redis';
import { MinimizedAlbum } from '../../../lib/minimizedLastfmService'; // Added
// We will import the mocked version of SpotifyWebApi later
// import SpotifyWebApi from 'spotify-web-api-node';
import { nanoid } from 'nanoid'; // Import nanoid
import { SharedGridData } from '../../../lib/types';

// Mock external dependencies
jest.mock('../../../lib/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(), // Changed from setex to set for new implementation
  },
}));

// Mock nanoid
jest.mock('nanoid');

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
    // The cache stores MinimizedAlbum[], not the { albums, sharedId } structure
    expect(data).toEqual(mockCachedData);
  });

  it('should fetch data from LastFM if not cached, generate sharedId, and store in Redis', async () => {
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
        artist: 'Test Artist', // MinimizedAlbum has artist as string
        image: 'extralarge.jpg', // MinimizedAlbum has image as string
        mbid: 'album-mbid-fetch',
        // playcount is not part of MinimizedAlbum from the transform in route
      },
    ];
    const mockSharedId = 'mock-nanoid';
    (nanoid as jest.Mock).mockReturnValue(mockSharedId);

    (redis.get as jest.Mock).mockResolvedValue(null); // Cache miss for album data
    (redis.set as jest.Mock).mockResolvedValue('OK'); // Mock Redis set for shared data

    mockFetch.mockResolvedValue({
      // Mock Last.fm fetch
      ok: true,
      json: jest.fn().mockResolvedValue(mockLastFmData),
    });

    const req = createMockRequest(mockUsername, mockPeriod);

    // Act
    const response = await GET(req);
    const responseBody = await response.json();

    // Assert
    expect(redis.get).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:minimized`
    );
    expect(mockFetch).toHaveBeenCalledWith(
      `${process.env.LASTFM_BASE_URL}?method=user.gettopalbums&user=${mockUsername}&period=${mockPeriod}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=9`
    );
    // Album data saved to cache (handleCaching)
    expect(redis.set).toHaveBeenCalledWith( // from handleCaching
      `lastfm:albums:${mockUsername}:${mockPeriod}:minimized`,
      JSON.stringify(expectedTransformedData), // Transformed data
      { ex: 3600 }
    );

    // Shared data saved to Redis
    const expectedSharedGridData: Partial<SharedGridData> = { // Using Partial as createdAt is dynamic
        id: mockSharedId,
        username: mockUsername,
        period: mockPeriod,
        albums: expectedTransformedData,
    };
    expect(redis.set).toHaveBeenCalledWith(
        `share:${mockSharedId}`,
        expect.stringContaining(JSON.stringify(expectedSharedGridData).slice(0, -1)), // Check parts of the stringified object
        { ex: 2592000 } // 30 days
    );

    expect(response.status).toBe(200);
    expect(responseBody.albums).toEqual(expectedTransformedData);
    expect(responseBody.sharedId).toBe(mockSharedId);
  });

  it('should fetch data and return empty array if LastFM returns no albums, sharedId should still be generated', async () => {
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

    const mockSharedId = 'empty-album-nanoid';
    (nanoid as jest.Mock).mockReturnValue(mockSharedId);
    (redis.get as jest.Mock).mockResolvedValue(null); // Cache miss
    (redis.set as jest.Mock).mockResolvedValue('OK'); // Mock Redis set for shared data & cache

    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockEmptyLastFmData),
    });

    const req = createMockRequest(mockUsername, mockPeriod);
    const response = await GET(req);
    const responseBody = await response.json();

    expect(redis.get).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:minimized`
    );
    expect(mockFetch).toHaveBeenCalled();

    // Album cache for "not found"
    expect(redis.set).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:minimized`,
      'NOT_FOUND_PLACEHOLDER',
      { ex: 600 } // notFoundCacheExpirySeconds
    );

    // Shared data should still be created and stored, even with empty albums
    const expectedSharedGridData: Partial<SharedGridData> = {
        id: mockSharedId,
        username: mockUsername,
        period: mockPeriod,
        albums: [], // Empty albums
    };
    expect(redis.set).toHaveBeenCalledWith(
        `share:${mockSharedId}`,
        expect.stringContaining(JSON.stringify(expectedSharedGridData).slice(0, -1)),
        { ex: 2592000 }
    );

    expect(response.status).toBe(200);
    expect(responseBody.albums).toEqual([]);
    expect(responseBody.sharedId).toBe(mockSharedId);
  });

  it('should return albums and null sharedId if Redis SET fails for shared data', async () => {
    const mockUsername = 'redis-fail-user';
    const mockPeriod = '1month';
    const mockLastFmAlbum = { // Copied from a previous test, adjust if needed
      name: 'Fetched Album Redis Fail',
      artist: { name: 'Test Artist RF', mbid: 'artist-mbid-rf', url: 'artist-url-rf' },
      image: [{ '#text': 'extralarge_rf.jpg', size: 'extralarge' }],
      mbid: 'album-mbid-rf', playcount: '150', url: 'album-url-rf',
    };
    const mockLastFmData = { topalbums: { album: [mockLastFmAlbum] } };
    const expectedTransformedData: MinimizedAlbum[] = [{
        name: 'Fetched Album Redis Fail',
        artist: 'Test Artist RF',
        image: 'extralarge_rf.jpg',
        mbid: 'album-mbid-rf',
    }];
    const mockSharedId = 'redis-fail-nanoid';

    (nanoid as jest.Mock).mockReturnValue(mockSharedId);
    (redis.get as jest.Mock).mockResolvedValue(null); // Cache miss for album data
    mockFetch.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(mockLastFmData) });

    // Simulate Redis failure for the shared data SET call
    (redis.set as jest.Mock)
        .mockImplementationOnce((key: string, value: string, options: any) => { // First call for album cache
            if (key.startsWith('lastfm:albums')) return Promise.resolve('OK');
            return Promise.reject(new Error('Simulated Redis SET Error for share data')); // Fail for share data
        })
        .mockImplementationOnce((key: string, value: string, options: any) => { // Second call for share data (this will be the one that fails)
             if (key.startsWith('share:')) return Promise.reject(new Error('Simulated Redis SET Error for share data'));
             return Promise.resolve('OK'); // default for other calls
        });


    const req = createMockRequest(mockUsername, mockPeriod);
    const response = await GET(req);
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody.albums).toEqual(expectedTransformedData);
    expect(responseBody.sharedId).toBeNull();
    expect(responseBody.error).toBe("Failed to save share data");

    // Verify album cache was still attempted (and succeeded in this mock setup for the first call)
    expect(redis.set).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:minimized`,
      JSON.stringify(expectedTransformedData),
      { ex: 3600 }
    );
    // Verify shared data set was attempted
    expect(redis.set).toHaveBeenCalledWith(
        `share:${mockSharedId}`,
        expect.any(String), // Value will be the stringified SharedGridData
        { ex: 2592000 }
    );
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
      `lastfm:albums:${mockUsername}:${mockPeriod}:minimized`
    );
    expect(mockFetch).toHaveBeenCalled();
    expect(response.status).toBe(500); // Route returns 500 for Last.fm fetch errors
    expect(responseBody.message).toBe('Error fetching albums'); // Ensure this matches the route's error
    expect(responseBody.sharedId).toBeUndefined(); // No sharedId on error
  });

  it('should handle errors thrown during general fetch processing and not return sharedId', async () => {
    // Arrange
    const mockUsername = 'testuser';
    const mockPeriod = 'overall';
    (redis.get as jest.Mock).mockResolvedValue(null); // Cache miss
    mockFetch.mockRejectedValue(new Error('Network error')); // Generic error during LastFM fetch

    const req = createMockRequest(mockUsername, mockPeriod);

    // Act
    const response = await GET(req);
    const responseBody = await response.json();

    // Assert
    expect(redis.get).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:minimized`
    );
    expect(mockFetch).toHaveBeenCalled();
    // redis.set for album cache might be called or not depending on where the error is thrown in handleCaching
    // redis.set for sharedId should not be called if fetch fails early
    const shareRedisCall = (redis.set as jest.Mock).mock.calls.find(call => call[0].startsWith('share:'));
    expect(shareRedisCall).toBeUndefined();

    expect(response.status).toBe(500);
    expect(responseBody.message).toBe('Error fetching albums');
    expect(responseBody.sharedId).toBeUndefined();
  });
});
