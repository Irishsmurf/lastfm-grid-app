import { GET } from './route';
import { redis } from '../../../lib/redis';
import { searchAlbum } from '../../../lib/spotifyService';

jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
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

jest.mock('../../../lib/firebase', () => ({
  getRemoteConfigValue: jest.fn((key: string) => ({
    asNumber: () => {
      if (key === 'spotify_cache_expiry_seconds') return 86400;
      if (key === 'not_found_cache_expiry_seconds') return 3600;
      return 0;
    },
    asString: () => '',
    asBoolean: () => false,
  })),
  defaultRemoteConfig: {},
  remoteConfig: null,
}));

jest.mock('../../../lib/spotifyService', () => ({
  searchAlbum: jest.fn(),
}));

const mockSearchAlbum = searchAlbum as jest.Mock;

const makeRequest = (albumName?: string, artistName?: string) => {
  const params = new URLSearchParams();
  if (albumName) params.set('albumName', albumName);
  if (artistName) params.set('artistName', artistName);
  return new Request(
    `http://localhost:3000/api/spotify-link?${params.toString()}`
  ) as any;
};

describe('GET /api/spotify-link', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret';
  });

  it('returns 400 when albumName is missing', async () => {
    const response = await GET(makeRequest(undefined, 'Artist'));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.message).toContain('Missing required query parameters');
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('returns 400 when artistName is missing', async () => {
    const response = await GET(makeRequest('Album', undefined));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.message).toContain('Missing required query parameters');
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('returns cached Spotify URL on cache hit', async () => {
    const albumName = 'Test Album';
    const artistName = 'Test Artist';
    const cachedUrl = 'https://open.spotify.com/album/cached';
    const cacheKey = `spotify:link:${encodeURIComponent(artistName)}:${encodeURIComponent(albumName)}`;

    (redis.get as jest.Mock).mockResolvedValue(
      JSON.stringify({ spotifyUrl: cachedUrl })
    );

    const response = await GET(makeRequest(albumName, artistName));
    const body = await response.json();

    expect(redis.get).toHaveBeenCalledWith(cacheKey);
    expect(mockSearchAlbum).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body.spotifyUrl).toBe(cachedUrl);
  });

  it('fetches Spotify URL on cache miss and caches the result', async () => {
    const albumName = 'Test Album';
    const artistName = 'Test Artist';
    const spotifyUrl = 'https://open.spotify.com/album/found';
    const cacheKey = `spotify:link:${encodeURIComponent(artistName)}:${encodeURIComponent(albumName)}`;

    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.setex as jest.Mock).mockResolvedValue('OK');
    mockSearchAlbum.mockResolvedValue({ spotifyUrl });

    const response = await GET(makeRequest(albumName, artistName));
    const body = await response.json();

    expect(redis.get).toHaveBeenCalledWith(cacheKey);
    expect(mockSearchAlbum).toHaveBeenCalledWith(albumName, artistName);
    expect(redis.setex).toHaveBeenCalledWith(
      cacheKey,
      86400,
      JSON.stringify({ spotifyUrl })
    );
    expect(response.status).toBe(200);
    expect(body.spotifyUrl).toBe(spotifyUrl);
  });

  it('returns null spotifyUrl and caches NOT_FOUND when album is not on Spotify', async () => {
    const albumName = 'Unknown Album';
    const artistName = 'Unknown Artist';
    const cacheKey = `spotify:link:${encodeURIComponent(artistName)}:${encodeURIComponent(albumName)}`;

    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.setex as jest.Mock).mockResolvedValue('OK');
    mockSearchAlbum.mockResolvedValue({ spotifyUrl: null });

    const response = await GET(makeRequest(albumName, artistName));
    const body = await response.json();

    expect(redis.setex).toHaveBeenCalledWith(
      cacheKey,
      3600,
      'SPOTIFY_NOT_FOUND'
    );
    expect(response.status).toBe(200);
    expect(body.spotifyUrl).toBeNull();
  });

  it('returns null spotifyUrl when NOT_FOUND placeholder is cached', async () => {
    const albumName = 'Cached Not Found';
    const artistName = 'Cached Artist';
    const cacheKey = `spotify:link:${encodeURIComponent(artistName)}:${encodeURIComponent(albumName)}`;

    (redis.get as jest.Mock).mockResolvedValue('SPOTIFY_NOT_FOUND');

    const response = await GET(makeRequest(albumName, artistName));
    const body = await response.json();

    expect(redis.get).toHaveBeenCalledWith(cacheKey);
    expect(mockSearchAlbum).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body.spotifyUrl).toBeNull();
  });
});
