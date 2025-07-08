import { NextRequest, NextResponse } from 'next/server';
import { getTopAlbums } from '@/lib/lastfmService'; // Keep LastFmTopAlbumsResponse if still needed for raw fetch
import {
  transformLastFmResponse,
  MinimizedAlbum,
} from '@/lib/minimizedLastfmService'; // Added
import { handleCaching } from '@/lib/cache';
import { logger } from '@/utils/logger';
import { nanoid } from 'nanoid';
import { SharedGridData } from '@/lib/types';
import { redis } from '@/lib/redis';
import { initializeRemoteConfig, getRemoteConfigValue } from '@/lib/firebase'; // Added

const CTX = 'AlbumsAPI';

export async function GET(req: NextRequest) {
  // Initialize Remote Config
  await initializeRemoteConfig(); // Best practice: call this at app startup

  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');
  const period = searchParams.get('period');

  logger.info(
    CTX,
    `Received request for username: ${username}, period: ${period}`
  );

  // Validate username
  if (username && (username.length < 2 || username.length > 50)) {
    logger.warn(CTX, `Invalid username: ${username}`);
    return NextResponse.json(
      { message: 'Invalid username. Must be between 2 and 50 characters.' },
      { status: 400 }
    );
  }

  // Validate period
  const validPeriods = [
    'overall',
    '7day',
    '1month',
    '3month',
    '6month',
    '12month',
  ];
  if (period && !validPeriods.includes(period)) {
    logger.warn(CTX, `Invalid period: ${period}`);
    return NextResponse.json({ message: 'Invalid period.' }, { status: 400 });
  }

  logger.info(
    CTX,
    `Username and period passed initial validation for username: ${username}, period: ${period}`
  );

  if (!username || !period) {
    logger.warn(CTX, 'Missing username or period in request');
    return NextResponse.json(
      { message: 'Username and period are required' },
      { status: 400 }
    );
  }

  // Encode username and period for cache key security
  const encodedUsername = encodeURIComponent(username);
  const encodedPeriod = encodeURIComponent(period);
  const cacheKey = `lastfm:albums:${encodedUsername}:${encodedPeriod}:minimized`;

  // Get cache expiry values from Remote Config
  const defaultCacheExpirySeconds = 3600; // 1 hour
  const defaultNotFoundCacheExpirySeconds = 600; // 10 minutes

  let cacheExpirySeconds = defaultCacheExpirySeconds;
  try {
    const remoteCacheExpiry = getRemoteConfigValue(
      'lastfm_cache_expiry_seconds'
    ).asNumber();
    if (remoteCacheExpiry > 0) {
      cacheExpirySeconds = remoteCacheExpiry;
    }
  } catch (error) {
    logger.warn(
      CTX,
      `Failed to get 'lastfm_cache_expiry_seconds' from Remote Config or invalid value. Using default: ${defaultCacheExpirySeconds}s. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  let notFoundCacheExpirySeconds = defaultNotFoundCacheExpirySeconds;
  try {
    const remoteNotFoundCacheExpiry = getRemoteConfigValue(
      'not_found_cache_expiry_seconds'
    ).asNumber();
    if (remoteNotFoundCacheExpiry > 0) {
      notFoundCacheExpirySeconds = remoteNotFoundCacheExpiry;
    }
  } catch (error) {
    logger.warn(
      CTX,
      `Failed to get 'not_found_cache_expiry_seconds' from Remote Config or invalid value. Using default: ${defaultNotFoundCacheExpirySeconds}s. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const isResultNotFound = (data: MinimizedAlbum[]): boolean => {
    // Updated type and logic
    return !data || data.length === 0;
  };

  const notFoundReturnValue: MinimizedAlbum[] = []; // Updated

  const fetchDataFunction = async (): Promise<MinimizedAlbum[]> => {
    // Updated return type
    logger.info(
      CTX,
      `Fetching fresh data from Last.fm for ${username}, period: ${period}`
    );
    // The getTopAlbums function itself handles Last.fm API errors (like invalid user)
    // and should return a structure that isNotFound can evaluate.
    // Default limit is 9 in getTopAlbums, can be passed if made dynamic here.
    const rawTopAlbums = await getTopAlbums(username, period);
    return transformLastFmResponse(rawTopAlbums); // Added transformation
  };

  try {
    // Updated generic type for handleCaching
    const data = await handleCaching<MinimizedAlbum[]>({
      cacheKey,
      fetchDataFunction,
      cacheExpirySeconds,
      isNotFound: isResultNotFound,
      notFoundValue: notFoundReturnValue,
      notFoundCacheExpirySeconds,
      // notFoundRedisPlaceholder can be left to default if 'NOT_FOUND_PLACEHOLDER' is acceptable
    });

    // If data matches notFoundReturnValue, it means it was either a cached "not found"
    // or a fresh fetch that resulted in "not found".
    // The client should receive this structured response.
    const lastFmAlbumCount = data ? data.length : 0;
    // spotifyLinkCount cannot be determined here as MinimizedAlbum does not have spotifyUrl

    logger.info(
      CTX,
      `Metrics for username: ${username}, period: ${period} - Last.fm albums: ${lastFmAlbumCount}`
    );
    logger.info(
      CTX,
      `Successfully fetched ${lastFmAlbumCount} albums for username: ${username}, period: ${period}`
    );

    const sharedId = nanoid();
    const sharedGridData: SharedGridData = {
      id: sharedId,
      username: username as string,
      period: period as string,
      albums: data || [], // Ensure data is not null/undefined
      createdAt: new Date().toISOString(),
    };

    try {
      // Get shared_grid_expiry_days from Remote Config
      const remoteConfigExpiryDays = getRemoteConfigValue(
        'shared_grid_expiry_days'
      ).asNumber();
      const defaultExpiryDays = 30;
      const expiryDays =
        remoteConfigExpiryDays > 0 ? remoteConfigExpiryDays : defaultExpiryDays;
      const expirySeconds = expiryDays * 24 * 60 * 60;

      await redis.set(
        `share:${sharedId}`,
        JSON.stringify(sharedGridData),
        'EX',
        expirySeconds
      );
      logger.info(
        CTX,
        `Successfully saved shared grid data to Redis for id: ${sharedId}`
      );
    } catch (redisError) {
      logger.error(
        CTX,
        `Error saving shared grid data to Redis for username: ${username}, period: ${period}: ${redisError instanceof Error ? redisError.message : String(redisError)}`
      );
      // Still return album data, but indicate sharing failed.
      const redisErrorResponse = {
        albums: data,
        sharedId: null,
        error:
          process.env.NODE_ENV === 'production'
            ? 'Failed to save share data.'
            : `Failed to save share data: ${redisError instanceof Error ? redisError.message : String(redisError)}`,
      };
      return NextResponse.json(redisErrorResponse, { status: 200 }); // Status 200 as per original, though 500 might be more appropriate.
    }

    return NextResponse.json(
      { albums: data, sharedId: sharedId },
      { status: 200 }
    );
  } catch (error) {
    let detailedErrorMessage = 'An unexpected error occurred';
    if (error instanceof Error) {
      detailedErrorMessage = error.message;
    }
    logger.error(
      CTX,
      `Error for ${username}/${period}: ${detailedErrorMessage}`
    );

    const responseMessage =
      process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred.'
        : 'Error fetching albums';

    const errorDetail =
      process.env.NODE_ENV === 'production'
        ? undefined // Omit detailed error in production
        : detailedErrorMessage;

    return NextResponse.json(
      { message: responseMessage, error: errorDetail },
      { status: 500 }
    );
  }
}
