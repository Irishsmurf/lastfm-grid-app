import { redis } from '@/lib/redis';
import { logger } from '@/utils/logger';

/**
 * In-flight fetches, keyed by cache key, so concurrent misses for the same key
 * share one upstream call instead of stampeding the origin API.
 *
 * Held on globalThis because Next.js can load this module more than once (dev
 * HMR, separate route bundles) and a per-module map would silently stop
 * deduplicating across those copies.
 */
const globalForCache = globalThis as unknown as {
  __cacheInFlight?: Map<string, Promise<unknown>>;
};

const inFlight: Map<
  string,
  Promise<unknown>
> = (globalForCache.__cacheInFlight ??= new Map());

interface HandleCachingParams<T> {
  cacheKey: string;
  fetchDataFunction: () => Promise<T>;
  cacheExpirySeconds: number;
  notFoundCacheExpirySeconds?: number;
  // Using a function to check for notFoundValue allows for more complex checks (e.g. empty array)
  isNotFound?: (value: T) => boolean;
  notFoundValue?: T | null; // The actual value to return when not found and placeholder was hit or fetch returned not found
  notFoundRedisPlaceholder?: string;
  /**
   * Marks a result as a transient failure: returned to the caller but never
   * written to cache, positively or negatively. Without this, an upstream
   * timeout gets persisted as if it were a real answer and the failure sticks
   * around for the full TTL.
   */
  isTransient?: (value: T) => boolean;
}

/**
 * Handles caching logic for any data fetching operation.
 *
 * It tries to retrieve data from Redis first. If not found, it calls the
 * `fetchDataFunction` to get fresh data, then stores it in Redis for
 * future requests. It also supports special handling for "not found"
 * scenarios, caching a placeholder for a shorter duration.
 *
 * @template T The expected type of the data to be cached.
 * @param {object} params The parameters for the caching function.
 * @param {string} params.cacheKey The key to use for caching in Redis.
 * @param {() => Promise<T>} params.fetchDataFunction An async function that fetches the fresh data.
 * @param {number} params.cacheExpirySeconds The time in seconds for which the data should be cached.
 * @param {number} [params.notFoundCacheExpirySeconds] Optional expiry time for "not found" results.
 * @param {(value: T) => boolean} [params.isNotFound] Optional function to determine if a fetched result is a "not found" case.
 * @param {T | null} [params.notFoundValue=null] Optional value to return when a "not found" placeholder is hit in cache or when fetchDataFunction returns a "not found" state.
 * @param {string} [params.notFoundRedisPlaceholder="NOT_FOUND_PLACEHOLDER"] Optional string to store in Redis for "not found" results.
 * @returns {Promise<T | null>} The cached or freshly fetched data, or null if notFoundValue is null and used.
 * @throws Will re-throw errors from `fetchDataFunction` or Redis operations.
 */
export async function handleCaching<T>({
  cacheKey,
  fetchDataFunction,
  cacheExpirySeconds,
  notFoundCacheExpirySeconds,
  isNotFound,
  notFoundValue = null,
  notFoundRedisPlaceholder = 'NOT_FOUND_PLACEHOLDER',
  isTransient,
}: HandleCachingParams<T>): Promise<T | null> {
  // --- Cache read. A Redis failure here degrades to an uncached fetch rather
  // than failing the request: a Redis blip used to surface as a 500.
  let cachedDataString: string | null = null;
  try {
    cachedDataString = await redis.get(cacheKey);
  } catch (error) {
    logger.warn(
      'Cache',
      `Cache read failed for ${cacheKey}, serving uncached: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (cachedDataString) {
    if (cachedDataString === notFoundRedisPlaceholder) {
      logger.info('Cache', `Cache hit for NOT_FOUND placeholder: ${cacheKey}`);
      return notFoundValue;
    }
    try {
      const parsedData = JSON.parse(cachedDataString);
      logger.info('Cache', `Cache hit: ${cacheKey}`);
      return parsedData as T;
    } catch (parseError) {
      logger.error('Cache', `Error parsing cached data for key ${cacheKey}:`, {
        error: parseError,
      });
      logger.warn(
        'Cache',
        `Evicting corrupted cache entry for key: ${cacheKey}`
      );
      try {
        await redis.del(cacheKey);
      } catch (delError) {
        logger.error(
          'Cache',
          `Failed to delete corrupted cache key ${cacheKey}:`,
          { error: delError }
        );
      }
    }
  }

  logger.info('Cache', `Cache miss: ${cacheKey}. Fetching fresh data.`);

  // --- Single-flight. Without this, N concurrent misses on the same key each
  // call the upstream API, so a popular key expiring under load produces a
  // thundering herd against Last.fm or Spotify.
  //
  // This dedupes within one process. On serverless that means one upstream call
  // per warm instance rather than one globally, which is still a large reduction
  // and avoids the failure modes of a distributed lock.
  const existing = inFlight.get(cacheKey);
  if (existing) {
    logger.info('Cache', `Joining in-flight fetch for ${cacheKey}`);
    return existing as Promise<T | null>;
  }

  const fetchPromise = (async (): Promise<T | null> => {
    const freshData = await fetchDataFunction();

    // A transient upstream failure is returned but never persisted, so the next
    // request retries instead of being served a cached error.
    if (isTransient?.(freshData)) {
      logger.warn(
        'Cache',
        `Transient upstream result for ${cacheKey}; not caching.`
      );
      return freshData;
    }

    // Determine if the result is a "not found" scenario
    // The `isNotFound` function provides flexibility, e.g. checking for { spotifyUrl: null } or an empty array
    const isResultNotFound = isNotFound
      ? isNotFound(freshData)
      : JSON.stringify(freshData) === JSON.stringify(notFoundValue);

    // Cache writes are best-effort: the data is already in hand, so a write
    // failure must not fail a request that otherwise succeeded.
    try {
      if (isResultNotFound) {
        if (notFoundCacheExpirySeconds && notFoundRedisPlaceholder) {
          logger.info(
            'Cache',
            `Caching NOT_FOUND placeholder for ${cacheKey} for ${notFoundCacheExpirySeconds}s`
          );
          await redis.setex(
            cacheKey,
            notFoundCacheExpirySeconds,
            notFoundRedisPlaceholder
          );
        }
      } else {
        logger.info(
          'Cache',
          `Caching fresh data for ${cacheKey} for ${cacheExpirySeconds}s`
        );
        await redis.setex(
          cacheKey,
          cacheExpirySeconds,
          JSON.stringify(freshData)
        );
      }
    } catch (error) {
      logger.warn(
        'Cache',
        `Cache write failed for ${cacheKey}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return freshData;
  })();

  inFlight.set(cacheKey, fetchPromise as Promise<unknown>);

  try {
    return await fetchPromise;
  } catch (error) {
    logger.error('Cache', `Error in handleCaching for key ${cacheKey}:`, {
      error,
    });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      `An unexpected error occurred in handleCaching for key ${cacheKey}`
    );
  } finally {
    // Always cleared, including on failure, so a failed fetch doesn't pin a
    // rejected promise that every later caller would join.
    inFlight.delete(cacheKey);
  }
}
