// app/api/albums/route.test.ts
import { GET } from './route';
import { NextRequest } from 'next/server';
import { redis } from '@/lib/redis';
import { nanoid } from 'nanoid';
import * as lastfmService from '@/lib/lastfmService';
import * as minimizedLastfmService from '@/lib/minimizedLastfmService';
import { MinimizedAlbum } from '@/lib/minimizedLastfmService';

// Mock Redis
jest.mock('@/lib/redis', () => ({
  redis: {
    get: jest.fn(), // For cache
    setex: jest.fn(), // For cache and sharedGrid
  },
}));

// Mock nanoid
jest.mock('nanoid');

// Mock Last.fm and transformation services
jest.mock('@/lib/lastfmService');
jest.mock('@/lib/minimizedLastfmService');

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('GET /api/albums', () => {
  const mockUsername = 'testuser';
  const mockPeriod = '1month';
  const mockReq = (username = mockUsername, period = mockPeriod) => {
    const url = `http://localhost/api/albums?username=${username}&period=${period}`;
    return new NextRequest(url) as NextRequest;
  };

  const mockAlbumsData: MinimizedAlbum[] = [
    { name: 'Album 1', artist: { name: 'Artist 1', mbid: 'a1'}, imageUrl: 'url1', mbid: 'm1', playcount: 10 },
    { name: 'Album 2', artist: { name: 'Artist 2', mbid: 'a2'}, imageUrl: 'url2', mbid: 'm2', playcount: 20 },
  ];

  beforeEach(() => {
    (redis.get as jest.Mock).mockReset();
    (redis.setex as jest.Mock).mockReset();
    (nanoid as jest.Mock).mockReset();
    (lastfmService.getTopAlbums as jest.Mock).mockReset();
    (minimizedLastfmService.transformLastFmResponse as jest.Mock).mockReset();
  });

  it('should return albums and sharedId, and save to Redis when albums are found', async () => {
    const mockSharedId = 'test-shared-id';
    (nanoid as jest.Mock).mockReturnValue(mockSharedId);
    (redis.get as jest.Mock).mockResolvedValue(null); // Cache miss for albums
    (lastfmService.getTopAlbums as jest.Mock).mockResolvedValue({ topalbums: { album: [] } }); // Mock raw response
    (minimizedLastfmService.transformLastFmResponse as jest.Mock).mockReturnValue(mockAlbumsData);

    const response = await GET(mockReq());
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.albums).toEqual(mockAlbumsData);
    expect(body.sharedId).toBe(mockSharedId);

    expect(nanoid).toHaveBeenCalledTimes(1);

    // Check caching of albums (from handleCaching via fetchDataFunction)
    // The key depends on username, period and ":minimized"
    const albumCacheKey = `lastfm:albums:${mockUsername}:${mockPeriod}:minimized`;
    expect(redis.setex).toHaveBeenCalledWith(
      albumCacheKey,
      3600, // cacheExpirySeconds for albums
      JSON.stringify(mockAlbumsData)
    );

    // Check saving of shared grid
    const sharedGridRedisKey = `sharedGrid:${mockSharedId}`;
    const expectedSharedGridData = {
      id: mockSharedId,
      username: mockUsername,
      period: mockPeriod,
      albums: mockAlbumsData,
      // createdAt will be dynamic, so we check its existence or mock Date
    };
    expect(redis.setex).toHaveBeenCalledWith(
      sharedGridRedisKey,
      2592000, // SHARED_GRID_EXPIRY_SECONDS
      expect.stringContaining(`"id":"${mockSharedId}"`) // Check parts of the stringified object
    );
    // More precise check for sharedGridData (might require mocking Date)
    const setexCall = (redis.setex as jest.Mock).mock.calls.find(call => call[0] === sharedGridRedisKey);
    expect(setexCall).toBeTruthy();
    if (setexCall) {
        const savedData = JSON.parse(setexCall[2]);
        expect(savedData.id).toBe(mockSharedId);
        expect(savedData.username).toBe(mockUsername);
        expect(savedData.albums).toEqual(mockAlbumsData);
        expect(savedData.createdAt).toBeDefined();
    }
  });

  it('should return empty albums and null sharedId when no albums are found', async () => {
    (redis.get as jest.Mock).mockResolvedValue(null); // Cache miss
    (lastfmService.getTopAlbums as jest.Mock).mockResolvedValue({ topalbums: { album: [] } });
    (minimizedLastfmService.transformLastFmResponse as jest.Mock).mockReturnValue([]); // No albums

    const response = await GET(mockReq());
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.albums).toEqual([]);
    expect(body.sharedId).toBeNull();
    expect(nanoid).not.toHaveBeenCalled();

    // Check caching of "not found" for albums
    const albumCacheKey = `lastfm:albums:${mockUsername}:${mockPeriod}:minimized`;
    const notFoundCacheExpirySeconds = 600;
    // The handleCaching might store a placeholder or the empty array itself.
    // If it stores notFoundReturnValue directly:
    expect(redis.setex).toHaveBeenCalledWith(
      albumCacheKey,
      notFoundCacheExpirySeconds, // notFoundCacheExpirySeconds for albums
      JSON.stringify([]) // or "NOT_FOUND_PLACEHOLDER" if that's how handleCaching is configured for this case
    );

    // Ensure sharedGrid data was NOT saved
    const sharedGridSetExCall = (redis.setex as jest.Mock).mock.calls.find(call => call[0].startsWith("sharedGrid:"));
    expect(sharedGridSetExCall).toBeUndefined();
  });

  it('should return 400 if username or period is missing', async () => {
    let response = await GET(mockReq('', '1month'));
    expect(response.status).toBe(400);
    let body = await response.json();
    expect(body.message).toBe('Username and period are required');

    response = await GET(mockReq('testuser', ''));
    expect(response.status).toBe(400);
    body = await response.json();
    expect(body.message).toBe('Username and period are required');
  });

  // Add test for error from getTopAlbums or transformLastFmResponse
  it('should return 500 and sharedId null if fetching albums fails', async () => {
    (redis.get as jest.Mock).mockResolvedValue(null); // Cache miss
    (lastfmService.getTopAlbums as jest.Mock).mockRejectedValue(new Error('Last.fm API error'));

    const response = await GET(mockReq());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.message).toBe('Error fetching albums');
    expect(body.albums).toEqual([]); // Or whatever the error response shape is
    expect(body.sharedId).toBeNull();
    expect(nanoid).not.toHaveBeenCalled();
  });
});
