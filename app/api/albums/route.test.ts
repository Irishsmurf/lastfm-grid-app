// /app/api/albums/route.test.ts

import { GET } from './route';
import { NextRequest } from 'next/server';
import { redis } from '../../../lib/redis';
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
  const url = new URL(`http://localhost:3000/api/albums?username=${username}&period=${period}`);
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
    // Cached data should not contain spotifyUrl anymore
    const mockCachedData = { topalbums: { album: [{ name: 'Test Album', artist: { name: 'Test Artist' } }] } };
    (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(mockCachedData));

    const req = createMockRequest(mockUsername, mockPeriod);

    // Act
    const response = await GET(req);
    const data = await response.json();

    // Assert
    expect(redis.get).toHaveBeenCalledWith(`lastfm:${mockUsername}:${mockPeriod}`);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(data).toEqual(mockCachedData);
  });

  it('should fetch data from LastFM if not cached', async () => {
    // Arrange
    const mockUsername = 'testuser';
    const mockPeriod = '1month';
    const mockLastFmAlbum = { name: 'Fetched Album', artist: { name: 'Test Artist' } };
    const mockLastFmData = { topalbums: { album: [mockLastFmAlbum] } };

    (redis.get as jest.Mock).mockResolvedValue(null);
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockLastFmData),
    });

    const req = createMockRequest(mockUsername, mockPeriod);

    // Act
    const response = await GET(req);
    const data = await response.json();

    // Assert
    expect(redis.get).toHaveBeenCalledWith(`lastfm:${mockUsername}:${mockPeriod}`);
    expect(mockFetch).toHaveBeenCalledWith(
      `${process.env.LASTFM_BASE_URL}?method=user.gettopalbums&user=${mockUsername}&period=${mockPeriod}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=9`
    );
    // Data saved to cache should be the raw LastFM data
    expect(redis.setex).toHaveBeenCalledWith(`lastfm:${mockUsername}:${mockPeriod}`, 3600, JSON.stringify(mockLastFmData));
    expect(response.status).toBe(200);
    expect(data).toEqual(mockLastFmData); // Response should be raw LastFM data
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
    });

    const req = createMockRequest(mockUsername, mockPeriod);

    // Act
    const response = await GET(req);
    const data = await response.json();

    // Assert
    expect(redis.get).toHaveBeenCalledWith(`lastfm:${mockUsername}:${mockPeriod}`);
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
    expect(redis.get).toHaveBeenCalledWith(`lastfm:${mockUsername}:${mockPeriod}`);
    expect(mockFetch).toHaveBeenCalled();
    // searchAlbums should not have been called
    expect(redis.setex).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    expect(data.message).toBe('Error fetching albums');
  });
});
