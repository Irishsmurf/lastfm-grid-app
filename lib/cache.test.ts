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
    expect(redis.setex).toHaveBeenCalledWith('test-key', 60, JSON.stringify(freshData));
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
    expect(redis.setex).toHaveBeenCalledWith('corrupted-key', 60, JSON.stringify(freshData));
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
    expect(redis.setex).toHaveBeenCalledWith('empty-key', 600, 'NOT_FOUND_PLACEHOLDER');
  });
});
