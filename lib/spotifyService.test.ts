import {
  resolveSpotifyLinks,
  spotifyLinkCacheKey,
  SPOTIFY_NOT_FOUND_PLACEHOLDER,
} from './spotifyService';
import { redis } from './redis';
import { SPOTIFY_LINK_TTL, SPOTIFY_NOT_FOUND_TTL } from './config';
import type { MinimizedAlbum } from './minimizedLastfmService';

jest.mock('./redis', () => ({
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
    mget: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const album = (name: string, artist: string, mbid: string): MinimizedAlbum => ({
  name,
  artist: { name: artist, mbid: `${mbid}-artist` },
  imageUrl: `${mbid}.jpg`,
  mbid,
  playcount: 1,
});

const spotifySearchResponse = (url: string | null) => ({
  ok: true,
  json: async () => ({
    albums: { items: url ? [{ external_urls: { spotify: url } }] : [] },
  }),
});

describe('spotifyLinkCacheKey', () => {
  it('matches the key format used by the single-album route', () => {
    // The route builds its key from the same helper; this pins the actual shape so
    // a change here can't silently orphan every existing cache entry.
    expect(spotifyLinkCacheKey('Test Artist', 'Test Album')).toBe(
      'spotify:link:Test%20Artist:Test%20Album'
    );
  });

  it('encodes characters that would otherwise break key structure', () => {
    expect(spotifyLinkCacheKey('A:B', 'C:D')).toBe('spotify:link:A%3AB:C%3AD');
  });
});

describe('resolveSpotifyLinks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redis.get as jest.Mock).mockResolvedValue('cached-token');
    (redis.setex as jest.Mock).mockResolvedValue('OK');
  });

  it('returns cached links in one MGET without hitting Spotify', async () => {
    (redis.mget as jest.Mock).mockResolvedValue([
      JSON.stringify({ spotifyUrl: 'https://open.spotify.com/album/1' }),
      SPOTIFY_NOT_FOUND_PLACEHOLDER,
    ]);

    const result = await resolveSpotifyLinks([
      album('Album 1', 'Artist 1', 'mbid-1'),
      album('Album 2', 'Artist 2', 'mbid-2'),
    ]);

    expect(redis.mget).toHaveBeenCalledTimes(1);
    expect(redis.mget).toHaveBeenCalledWith(
      'spotify:link:Artist%201:Album%201',
      'spotify:link:Artist%202:Album%202'
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.complete).toBe(true);
    expect(result.links).toEqual({
      'mbid-1': 'https://open.spotify.com/album/1',
      'mbid-2': null,
    });
  });

  it('searches for misses and writes them through with the right TTLs', async () => {
    (redis.mget as jest.Mock).mockResolvedValue([null, null]);
    mockFetch
      .mockResolvedValueOnce(
        spotifySearchResponse('https://open.spotify.com/album/found')
      )
      .mockResolvedValueOnce(spotifySearchResponse(null));

    const result = await resolveSpotifyLinks([
      album('Found', 'Artist F', 'mbid-found'),
      album('Missing', 'Artist M', 'mbid-missing'),
    ]);

    expect(result.complete).toBe(true);
    expect(result.links).toEqual({
      'mbid-found': 'https://open.spotify.com/album/found',
      'mbid-missing': null,
    });

    expect(redis.setex).toHaveBeenCalledWith(
      'spotify:link:Artist%20F:Found',
      SPOTIFY_LINK_TTL,
      JSON.stringify({ spotifyUrl: 'https://open.spotify.com/album/found' })
    );
    expect(redis.setex).toHaveBeenCalledWith(
      'spotify:link:Artist%20M:Missing',
      SPOTIFY_NOT_FOUND_TTL,
      SPOTIFY_NOT_FOUND_PLACEHOLDER
    );
  });

  it('skips albums with no mbid, since the client has no key for them', async () => {
    (redis.mget as jest.Mock).mockResolvedValue([null]);
    mockFetch.mockResolvedValue(spotifySearchResponse(null));

    const result = await resolveSpotifyLinks([
      album('Keyed', 'Artist K', 'mbid-k'),
      { ...album('Unkeyed', 'Artist U', ''), mbid: '' },
    ]);

    expect(redis.mget).toHaveBeenCalledWith('spotify:link:Artist%20K:Keyed');
    expect(Object.keys(result.links)).toEqual(['mbid-k']);
  });

  it('returns early with no Redis call when nothing is keyable', async () => {
    const result = await resolveSpotifyLinks([]);

    expect(redis.mget).not.toHaveBeenCalled();
    expect(result).toEqual({ links: {}, complete: true });
  });

  it('degrades to a full miss when the cache read fails', async () => {
    (redis.mget as jest.Mock).mockRejectedValue(new Error('Redis down'));
    mockFetch.mockResolvedValue(
      spotifySearchResponse('https://open.spotify.com/album/x')
    );

    const result = await resolveSpotifyLinks([
      album('Album X', 'Artist X', 'mbid-x'),
    ]);

    // A cache outage must not fail the grid.
    expect(result.links['mbid-x']).toBe('https://open.spotify.com/album/x');
  });

  it('does not cache a transient failure as "no match"', async () => {
    (redis.mget as jest.Mock).mockResolvedValue([null]);
    (redis.setex as jest.Mock).mockRejectedValue(new Error('write failed'));
    mockFetch.mockResolvedValue(
      spotifySearchResponse('https://open.spotify.com/album/y')
    );

    const result = await resolveSpotifyLinks([
      album('Album Y', 'Artist Y', 'mbid-y'),
    ]);

    // The link still resolves for this request even though persisting it failed.
    expect(result.links['mbid-y']).toBe('https://open.spotify.com/album/y');
    expect(redis.setex).not.toHaveBeenCalledWith(
      expect.any(String),
      SPOTIFY_NOT_FOUND_TTL,
      SPOTIFY_NOT_FOUND_PLACEHOLDER
    );
  });

  it('reports incomplete rather than stalling when the deadline elapses', async () => {
    (redis.mget as jest.Mock).mockResolvedValue([null, null, null]);
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve(spotifySearchResponse('https://open.spotify.com/s')),
            50
          )
        )
    );

    const result = await resolveSpotifyLinks(
      [
        album('A', 'Artist A', 'mbid-a'),
        album('B', 'Artist B', 'mbid-b'),
        album('C', 'Artist C', 'mbid-c'),
      ],
      { deadlineMs: 0 }
    );

    // An already-elapsed deadline means no searches are attempted at all.
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.complete).toBe(false);
  });
});
