// /app/api/albums/route.test.ts

import { GET } from './route';
import { NextRequest } from 'next/server';
import { redis } from '../../../lib/redis';

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
  return new Request(url.toString()) as NextRequest;
};

describe('GET /api/albums', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should return cached data if available', async () => {
    // Arrange
    const mockUsername = 'testuser';
    const mockPeriod = '7day';
    const mockCachedData = { albums: { album: [{ name: 'Test Album' }] } };
    (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(mockCachedData));

    const req = createMockRequest(mockUsername, mockPeriod);

    // Act
    const response = await GET(req);
    const data = await response.json();

    // Assert
    expect(redis.get).toHaveBeenCalledWith(`lastfm:${mockUsername}:${mockPeriod}`);
    expect(mockFetch).not.toHaveBeenCalled(); // Should not fetch from LastFM
    expect(response.status).toBe(200);
    expect(data).toEqual(mockCachedData);
  });

  it('should fetch data from LastFM if not cached', async () => {
    // Arrange
    const mockUsername = 'testuser';
    const mockPeriod = '1month';
    const mockLastFmData = { albums: { album: [{ name: 'Fetched Album' }] } };
    (redis.get as jest.Mock).mockResolvedValue(null);
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockLastFmData),
    });
    process.env.LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';
    process.env.LASTFM_API_KEY = 'testapikey';

    const req = createMockRequest(mockUsername, mockPeriod);

    // Act
    const response = await GET(req);
    const data = await response.json();

    // Assert
    expect(redis.get).toHaveBeenCalledWith(`lastfm:${mockUsername}:${mockPeriod}`);
    expect(mockFetch).toHaveBeenCalledWith(
      `${process.env.LASTFM_BASE_URL}?method=user.gettopalbums&user=${mockUsername}&period=${mockPeriod}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=9`
    );
    expect(redis.setex).toHaveBeenCalledWith(`lastfm:${mockUsername}:${mockPeriod}`, 3600, JSON.stringify(mockLastFmData));
    expect(response.status).toBe(200);
    expect(data).toEqual(mockLastFmData);
  });

  it('should handle LastFM fetch failure', async () => {
    // Arrange
    const mockUsername = 'testuser';
    const mockPeriod = 'overall';
    (redis.get as jest.Mock).mockResolvedValue(null);
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
      status: 404,
    });
    process.env.LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';
    process.env.LASTFM_API_KEY = 'testapikey';

    const req = createMockRequest(mockUsername, mockPeriod);

    // Act
    const response = await GET(req);
    const data = await response.json();

    // Assert
    expect(redis.get).toHaveBeenCalledWith(`lastfm:${mockUsername}:${mockPeriod}`);
    expect(mockFetch).toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    expect(data.message).toBe('Error fetching albums');
  });

  it('should handle errors thrown during fetch', async () => {
    // Arrange
    const mockUsername = 'testuser';
    const mockPeriod = 'overall';
    (redis.get as jest.Mock).mockResolvedValue(null);
    mockFetch.mockRejectedValue(new Error('Network error'));
    process.env.LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';
    process.env.LASTFM_API_KEY = 'testapikey';

    const req = createMockRequest(mockUsername, mockPeriod);

    // Act
    const response = await GET(req);
    const data = await response.json();

    // Assert
    expect(redis.get).toHaveBeenCalledWith(`lastfm:${mockUsername}:${mockPeriod}`);
    expect(mockFetch).toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    expect(data.message).toBe('Error fetching albums');
  });
});
