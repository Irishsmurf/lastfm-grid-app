import { handleCaching } from './cache';
import { redis } from './redis';
import { logger } from '../utils/logger';

jest.mock('./redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

describe('handleCaching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns cached data on cache hit', async () => {
    const data = { foo: 'bar' };
    (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(data));

    const result = await handleCaching({
      cacheKey: 'test-key',
      fetchDataFunction: jest.fn(),
      cacheExpirySeconds: 60,
    });

    expect(result).toEqual(data);
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('returns notFoundValue on NOT_FOUND_PLACEHOLDER hit', async () => {
    (redis.get as jest.Mock).mockResolvedValue('NOT_FOUND_PLACEHOLDER');

    const result = await handleCaching({
      cacheKey: 'test-key',
      fetchDataFunction: jest.fn(),
      cacheExpirySeconds: 60,
      notFoundValue: [],
    });

    expect(result).toEqual([]);
  });

  it('fetches fresh data on cache miss and caches it', async () => {
    const freshData = { foo: 'fresh' };
    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.setex as jest.Mock).mockResolvedValue('OK');
    const fetchFn = jest.fn().mockResolvedValue(freshData);

    const result = await handleCaching({
      cacheKey: 'test-key',
      fetchDataFunction: fetchFn,
      cacheExpirySeconds: 60,
    });

    expect(result).toEqual(freshData);
    expect(fetchFn).toHaveBeenCalled();
    expect(redis.setex).toHaveBeenCalledWith(
      'test-key',
      60,
      JSON.stringify(freshData)
    );
  });

  it('deletes corrupted cache entry, logs warn, and fetches fresh data', async () => {
    const freshData = { foo: 'fresh' };
    (redis.get as jest.Mock).mockResolvedValue('not-valid-json{{{');
    (redis.del as jest.Mock).mockResolvedValue(1);
    (redis.setex as jest.Mock).mockResolvedValue('OK');
    const fetchFn = jest.fn().mockResolvedValue(freshData);

    const result = await handleCaching({
      cacheKey: 'corrupted-key',
      fetchDataFunction: fetchFn,
      cacheExpirySeconds: 60,
    });

    expect(redis.del).toHaveBeenCalledWith('corrupted-key');
    expect(logger.warn).toHaveBeenCalledWith(
      'Cache',
      expect.stringContaining('corrupted-key')
    );
    expect(fetchFn).toHaveBeenCalled();
    expect(result).toEqual(freshData);
    expect(redis.setex).toHaveBeenCalledWith(
      'corrupted-key',
      60,
      JSON.stringify(freshData)
    );
  });

  it('still fetches fresh data when redis.del fails on corrupted entry', async () => {
    const freshData = { foo: 'fresh' };
    (redis.get as jest.Mock).mockResolvedValue('not-valid-json{{{');
    (redis.del as jest.Mock).mockRejectedValue(new Error('Redis del failed'));
    (redis.setex as jest.Mock).mockResolvedValue('OK');
    const fetchFn = jest.fn().mockResolvedValue(freshData);

    const result = await handleCaching({
      cacheKey: 'corrupted-key',
      fetchDataFunction: fetchFn,
      cacheExpirySeconds: 60,
    });

    expect(redis.del).toHaveBeenCalledWith('corrupted-key');
    expect(logger.error).toHaveBeenCalledWith(
      'Cache',
      expect.stringContaining('Failed to delete corrupted cache key'),
      expect.objectContaining({ error: expect.any(Error) })
    );
    expect(fetchFn).toHaveBeenCalled();
    expect(result).toEqual(freshData);
  });

  it('caches NOT_FOUND_PLACEHOLDER when fetch returns not-found result', async () => {
    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.setex as jest.Mock).mockResolvedValue('OK');
    const fetchFn = jest.fn().mockResolvedValue([]);

    const result = await handleCaching({
      cacheKey: 'empty-key',
      fetchDataFunction: fetchFn,
      cacheExpirySeconds: 3600,
      notFoundCacheExpirySeconds: 600,
      isNotFound: (v: unknown[]) => v.length === 0,
      notFoundValue: [],
    });

    expect(result).toEqual([]);
    expect(redis.setex).toHaveBeenCalledWith(
      'empty-key',
      600,
      'NOT_FOUND_PLACEHOLDER'
    );
  });

  describe('resilience', () => {
    it('serves uncached rather than failing when the cache read errors', async () => {
      (redis.get as jest.Mock).mockRejectedValue(new Error('Redis down'));
      (redis.setex as jest.Mock).mockResolvedValue('OK');
      const freshData = { foo: 'fresh' };
      const fetchFn = jest.fn().mockResolvedValue(freshData);

      // A Redis outage used to propagate out of handleCaching and become a 500.
      const result = await handleCaching({
        cacheKey: 'read-fail-key',
        fetchDataFunction: fetchFn,
        cacheExpirySeconds: 60,
      });

      expect(result).toEqual(freshData);
      expect(fetchFn).toHaveBeenCalled();
    });

    it('still returns data when the cache write fails', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      (redis.setex as jest.Mock).mockRejectedValue(new Error('write failed'));
      const freshData = { foo: 'fresh' };

      const result = await handleCaching({
        cacheKey: 'write-fail-key',
        fetchDataFunction: jest.fn().mockResolvedValue(freshData),
        cacheExpirySeconds: 60,
      });

      // The data is already in hand; a write failure must not lose it.
      expect(result).toEqual(freshData);
    });

    it('collapses concurrent misses on one key into a single fetch', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      (redis.setex as jest.Mock).mockResolvedValue('OK');

      // Deferred up front: handleCaching awaits the cache read before calling
      // fetchDataFunction, so the resolver has to exist before any call starts.
      let resolveFetch!: (value: { foo: string }) => void;
      const pending = new Promise<{ foo: string }>((resolve) => {
        resolveFetch = resolve;
      });
      const fetchFn = jest.fn(() => pending);

      const calls = Array.from({ length: 5 }, () =>
        handleCaching({
          cacheKey: 'stampede-key',
          fetchDataFunction: fetchFn,
          cacheExpirySeconds: 60,
        })
      );

      // Let all five get past the cache read and reach the single-flight gate.
      await new Promise((resolve) => setTimeout(resolve, 0));
      resolveFetch({ foo: 'once' });
      const results = await Promise.all(calls);

      // Five concurrent misses, one upstream call.
      expect(fetchFn).toHaveBeenCalledTimes(1);
      results.forEach((r) => expect(r).toEqual({ foo: 'once' }));
    });

    it('does not pin a failed fetch for later callers', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      (redis.setex as jest.Mock).mockResolvedValue('OK');

      const fetchFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('upstream down'))
        .mockResolvedValueOnce({ foo: 'recovered' });

      await expect(
        handleCaching({
          cacheKey: 'recovery-key',
          fetchDataFunction: fetchFn,
          cacheExpirySeconds: 60,
        })
      ).rejects.toThrow('upstream down');

      // The in-flight entry must be cleared on failure, or every later caller
      // would join the same rejected promise.
      await expect(
        handleCaching({
          cacheKey: 'recovery-key',
          fetchDataFunction: fetchFn,
          cacheExpirySeconds: 60,
        })
      ).resolves.toEqual({ foo: 'recovered' });
    });

    it('never caches a result marked transient', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      (redis.setex as jest.Mock).mockResolvedValue('OK');
      const transientResult = { spotifyUrl: null, transient: true };

      const result = await handleCaching({
        cacheKey: 'transient-key',
        fetchDataFunction: jest.fn().mockResolvedValue(transientResult),
        cacheExpirySeconds: 2592000,
        notFoundCacheExpirySeconds: 86400,
        isNotFound: (v: { spotifyUrl: string | null; transient?: boolean }) =>
          v.spotifyUrl === null && !v.transient,
        isTransient: (v: { transient?: boolean }) => !!v.transient,
        notFoundValue: { spotifyUrl: null },
      });

      expect(result).toEqual(transientResult);
      // Neither positively nor negatively cached — an upstream blip must not
      // stick around for the full TTL.
      expect(redis.setex).not.toHaveBeenCalled();
    });
  });
});
