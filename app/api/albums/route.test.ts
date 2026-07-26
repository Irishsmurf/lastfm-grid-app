import { GET } from './route';
import { redis } from '../../../lib/redis';
import { MinimizedAlbum } from '../../../lib/minimizedLastfmService';
import { nanoid } from 'nanoid';
import { apiRequestCounter, apiRequestDuration } from '../../../lib/metrics';

jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn(
      (
        body: unknown,
        init?: { status?: number; headers?: Record<string, string> }
      ) => ({
        status: init?.status ?? 200,
        headers: new Headers(init?.headers ?? {}),
        json: async () => body,
      })
    ),
  },
}));

jest.mock('../../../lib/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock('../../../lib/metrics', () => ({
  apiRequestCounter: { inc: jest.fn() },
  apiRequestDuration: { startTimer: jest.fn(() => jest.fn()) },
  lastfmAlbumCount: { inc: jest.fn() },
  spotifyLinkCount: { inc: jest.fn() },
}));

jest.mock('../../../lib/firebase', () => ({
  getRemoteConfigValue: jest.fn((key: string) => ({
    asNumber: () => {
      if (key === 'lastfm_cache_expiry_seconds') return 3600;
      if (key === 'not_found_cache_expiry_seconds') return 600;
      return 0;
    },
    asString: () => '',
    asBoolean: () => false,
  })),
  defaultRemoteConfig: {},
  remoteConfig: null,
}));

jest.mock('nanoid');

const mockFetch = jest.fn();
global.fetch = mockFetch;

const createMockRequest = (username: string, period: string, limit = 9) => {
  const url = `http://localhost:3000/api/albums?username=${username}&period=${period}&limit=${limit}`;
  return new Request(url) as any;
};

describe('GET /api/albums', () => {
  let mockEnd: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';
    process.env.LASTFM_API_KEY = 'testapikey';

    mockEnd = jest.fn();
    (apiRequestDuration.startTimer as jest.Mock).mockReturnValue(mockEnd);
  });

  it('should return cached album data when available', async () => {
    const mockUsername = 'testuser';
    const mockPeriod = '7day';
    const mockCachedData: MinimizedAlbum[] = [
      {
        name: 'Test Album',
        artist: { name: 'Test Artist', mbid: 'artist-mbid-cache' },
        imageUrl: 'cached.jpg',
        mbid: 'album-mbid-cache',
        playcount: 10,
      },
    ];
    (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(mockCachedData));
    (nanoid as jest.Mock).mockReturnValue('share-id-cache');
    (redis.set as jest.Mock).mockResolvedValue('OK');

    const req = createMockRequest(mockUsername, mockPeriod);
    const response = await GET(req);
    const data = await response.json();

    expect(redis.get).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:9:minimized`
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(data.albums).toEqual(mockCachedData);
  });

  it('should fetch from Last.fm on cache miss, cache result, and save shared grid', async () => {
    const mockUsername = 'testuser';
    const mockPeriod = '1month';
    const mockLastFmData = {
      topalbums: {
        album: [
          {
            name: 'Fetched Album',
            artist: { name: 'Test Artist', mbid: 'artist-mbid-fetch', url: '' },
            image: [
              { '#text': '', size: 'small' },
              { '#text': '', size: 'medium' },
              { '#text': '', size: 'large' },
              { '#text': 'extralarge.jpg', size: 'extralarge' },
            ],
            mbid: 'album-mbid-fetch',
            playcount: '120',
            url: '',
          },
        ],
        '@attr': {
          user: mockUsername,
          totalPages: '1',
          page: '1',
          perPage: '9',
          total: '1',
        },
      },
    };

    const expectedAlbums: MinimizedAlbum[] = [
      {
        name: 'Fetched Album',
        artist: { name: 'Test Artist', mbid: 'artist-mbid-fetch' },
        imageUrl: 'extralarge.jpg',
        mbid: 'album-mbid-fetch',
        playcount: 120,
      },
    ];

    const mockSharedId = 'mock-nanoid';
    (nanoid as jest.Mock).mockReturnValue(mockSharedId);
    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.setex as jest.Mock).mockResolvedValue('OK');
    (redis.set as jest.Mock).mockResolvedValue('OK');
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockLastFmData),
    });

    const req = createMockRequest(mockUsername, mockPeriod);
    const response = await GET(req);
    const responseBody = await response.json();

    expect(redis.get).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:9:minimized`
    );
    expect(redis.setex).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:9:minimized`,
      3600,
      JSON.stringify(expectedAlbums)
    );
    // Share records are created by POST /api/share, never on this read path —
    // this is what keeps the response identical for identical inputs, and so
    // cacheable at the CDN.
    expect(redis.set).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(responseBody.albums).toEqual(expectedAlbums);
    expect(responseBody.sharedId).toBeUndefined();
    expect(response.headers.get('Vercel-CDN-Cache-Control')).toContain(
      'max-age=3600'
    );
  });

  it('should return empty albums and still generate a shared grid when Last.fm returns none', async () => {
    const mockUsername = 'testuser';
    const mockPeriod = '3month';
    const emptyLastFmData = {
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
    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.setex as jest.Mock).mockResolvedValue('OK');
    (redis.set as jest.Mock).mockResolvedValue('OK');
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(emptyLastFmData),
    });

    const req = createMockRequest(mockUsername, mockPeriod);
    const response = await GET(req);
    const responseBody = await response.json();

    expect(redis.setex).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:9:minimized`,
      600,
      'NOT_FOUND_PLACEHOLDER'
    );
    expect(response.status).toBe(200);
    expect(responseBody.albums).toEqual([]);
    expect(responseBody.sharedId).toBeUndefined();
    // Empty results get a short edge TTL so a brand-new user isn't stuck with an
    // empty grid cached at the edge for an hour.
    expect(response.headers.get('Vercel-CDN-Cache-Control')).toContain(
      'max-age=600'
    );
  });

  it('serves a cache hit without any Redis writes', async () => {
    const mockUsername = 'cached-user';
    const mockPeriod = '1month';
    const cachedAlbums: MinimizedAlbum[] = [
      {
        name: 'Cached Album',
        artist: { name: 'Cached Artist', mbid: 'cached-artist-mbid' },
        imageUrl: 'cached.jpg',
        mbid: 'cached-mbid',
        playcount: 42,
      },
    ];

    (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedAlbums));

    const req = createMockRequest(mockUsername, mockPeriod);
    const response = await GET(req);
    const responseBody = await response.json();

    // The whole point of the change: a cache hit is one Redis GET and nothing
    // else. It used to also mint a nanoid and SET a permanent share:* key on
    // every single request, which grew Redis with traffic rather than with
    // actual shares.
    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(responseBody.albums).toEqual(cachedAlbums);
  });

  it('uses a longer cache lifetime for slow-moving periods', async () => {
    const mockUsername = 'overall-user';
    const mockPeriod = 'overall';

    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.setex as jest.Mock).mockResolvedValue('OK');
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        topalbums: {
          album: [
            {
              name: 'Overall Album',
              artist: { name: 'Overall Artist', mbid: 'o-artist', url: '' },
              image: [{ '#text': 'o.jpg', size: 'extralarge' }],
              mbid: 'o-mbid',
              playcount: '999',
              url: '',
            },
          ],
        },
      }),
    });

    const response = await GET(createMockRequest(mockUsername, mockPeriod));

    // 'overall' charts barely move, so they get 6h rather than 1h.
    expect(redis.setex).toHaveBeenCalledWith(
      `lastfm:albums:${mockUsername}:${mockPeriod}:9:minimized`,
      21600,
      expect.any(String)
    );
    expect(response.headers.get('Vercel-CDN-Cache-Control')).toContain(
      'max-age=21600'
    );
  });

  it('should return 500 when Last.fm fetch fails', async () => {
    const mockUsername = 'testuser';
    const mockPeriod = 'overall';
    (redis.get as jest.Mock).mockResolvedValue(null);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: jest.fn().mockResolvedValue('Not Found'),
    });

    const req = createMockRequest(mockUsername, mockPeriod);
    const response = await GET(req);
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody.message).toBe('Error fetching albums');
  });

  it('should call end() and increment counter on invalid limit', async () => {
    const url =
      'http://localhost:3000/api/albums?username=testuser&period=7day&limit=999';
    const req = new Request(url) as any;
    const response = await GET(req);

    expect(response.status).toBe(400);
    expect(mockEnd).toHaveBeenCalled();
    expect(apiRequestCounter.inc).toHaveBeenCalledWith(
      expect.objectContaining({ status_code: '400' })
    );
  });

  it('should call end() and increment counter on invalid username', async () => {
    const url = 'http://localhost:3000/api/albums?username=x&period=7day';
    const req = new Request(url) as any;
    const response = await GET(req);

    expect(response.status).toBe(400);
    expect(mockEnd).toHaveBeenCalled();
    expect(apiRequestCounter.inc).toHaveBeenCalledWith(
      expect.objectContaining({ status_code: '400' })
    );
  });

  it('should call end() and increment counter on invalid period', async () => {
    const url =
      'http://localhost:3000/api/albums?username=testuser&period=badperiod';
    const req = new Request(url) as any;
    const response = await GET(req);

    expect(response.status).toBe(400);
    expect(mockEnd).toHaveBeenCalled();
    expect(apiRequestCounter.inc).toHaveBeenCalledWith(
      expect.objectContaining({ status_code: '400' })
    );
  });

  it('should call end() and increment counter on missing username/period', async () => {
    const url = 'http://localhost:3000/api/albums';
    const req = new Request(url) as any;
    const response = await GET(req);

    expect(response.status).toBe(400);
    expect(mockEnd).toHaveBeenCalled();
    expect(apiRequestCounter.inc).toHaveBeenCalledWith(
      expect.objectContaining({ status_code: '400' })
    );
  });

  it('should call end() and increment counter when Redis share save fails', async () => {
    const mockLastFmData = {
      topalbums: {
        album: [
          {
            name: 'RF Album',
            artist: { name: 'RF Artist', mbid: 'rf-artist-mbid', url: '' },
            image: [{ '#text': 'rf.jpg', size: 'extralarge' }],
            mbid: 'rf-mbid',
            playcount: '150',
            url: '',
          },
        ],
      },
    };

    (nanoid as jest.Mock).mockReturnValue('redis-fail-nanoid');
    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.setex as jest.Mock).mockResolvedValue('OK');
    (redis.set as jest.Mock).mockRejectedValue(new Error('Redis SET failed'));
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockLastFmData),
    });

    const req = createMockRequest('redis-fail-user', '1month');
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(mockEnd).toHaveBeenCalled();
    expect(apiRequestCounter.inc).toHaveBeenCalledWith(
      expect.objectContaining({ status_code: '200' })
    );
  });

  it('should return 500 when a network error is thrown', async () => {
    const mockUsername = 'testuser';
    const mockPeriod = 'overall';
    (redis.get as jest.Mock).mockResolvedValue(null);
    mockFetch.mockRejectedValue(new Error('Network error'));

    const req = createMockRequest(mockUsername, mockPeriod);
    const response = await GET(req);
    const responseBody = await response.json();

    const shareRedisCall = (redis.set as jest.Mock).mock.calls.find((call) =>
      call[0].startsWith('share:')
    );
    expect(shareRedisCall).toBeUndefined();
    expect(response.status).toBe(500);
    expect(responseBody.message).toBe('Error fetching albums');
  });
});
