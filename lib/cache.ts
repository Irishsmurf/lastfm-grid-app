import { redis } from '@/lib/redis';

interface HandleCachingParams<T> {
  cacheKey: string;
  fetchDataFunction: () => Promise<T>;
  cacheExpirySeconds: number;
  notFoundCacheExpirySeconds?: number;
  // Using a function to check for notFoundValue allows for more complex checks (e.g. empty array)
  isNotFound?: (value: T) => boolean;
  notFoundValue?: T | null; // The actual value to return when not found and placeholder was hit or fetch returned not found
  notFoundRedisPlaceholder?: string;
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
}: HandleCachingParams<T>): Promise<T | null> {
  try {
    const cachedDataString = await redis.get(cacheKey);

    if (cachedDataString) {
      if (cachedDataString === notFoundRedisPlaceholder) {
        console.log(`Cache hit for NOT_FOUND placeholder: ${cacheKey}`);
        return notFoundValue;
      }
      try {
        const parsedData = JSON.parse(cachedDataString);
        console.log(`Cache hit: ${cacheKey}`);
        return parsedData as T;
      } catch (parseError) {
        console.error(
          `Error parsing cached data for key ${cacheKey}:`,
          parseError
        );
        // Proceed to fetch fresh data if parsing fails
      }
    }
    console.log(`Cache miss: ${cacheKey}. Fetching fresh data.`);
    const freshData = await fetchDataFunction();

    // Determine if the result is a "not found" scenario
    // The `isNotFound` function provides flexibility, e.g. checking for { spotifyUrl: null } or an empty array
    const isResultNotFound = isNotFound
      ? isNotFound(freshData)
      : JSON.stringify(freshData) === JSON.stringify(notFoundValue);

    if (isResultNotFound) {
      if (notFoundCacheExpirySeconds && notFoundRedisPlaceholder) {
        console.log(
          `Caching NOT_FOUND placeholder for ${cacheKey} for ${notFoundCacheExpirySeconds}s`
        );
        await redis.setex(
          cacheKey,
          notFoundCacheExpirySeconds,
          notFoundRedisPlaceholder
        );
      }
      return freshData; // Return the original "not found" data (e.g., null or { spotifyUrl: null })
    } else {
      // Cache the "found" result
      const serializedData = JSON.stringify(freshData);
      console.log(
        `Caching fresh data for ${cacheKey} for ${cacheExpirySeconds}s`
      );
      await redis.setex(cacheKey, cacheExpirySeconds, serializedData);
      return freshData;
    }
  } catch (error) {
    console.error(`Error in handleCaching for key ${cacheKey}:`, error);
    // Depending on requirements, you might want to re-throw,
    // or return a default/fallback value, or the potentially stale notFoundValue.
    // For now, re-throwing to make the caller aware.
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      `An unexpected error occurred in handleCaching for key ${cacheKey}`
    );
  }
}
