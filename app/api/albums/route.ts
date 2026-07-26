import { NextRequest, NextResponse } from 'next/server';
import { getTopAlbums } from '@/lib/lastfmService'; // Keep LastFmTopAlbumsResponse if still needed for raw fetch
import {
  transformLastFmResponse,
  MinimizedAlbum,
} from '@/lib/minimizedLastfmService'; // Added
import { handleCaching } from '@/lib/cache';
import { resolveSpotifyLinks } from '@/lib/spotifyService';
import { logger } from '@/utils/logger';
import {
  albumsTtlSeconds,
  ALBUMS_NOT_FOUND_TTL,
  cacheHeaders,
  NO_STORE,
} from '@/lib/config';
import {
  apiRequestCounter,
  apiRequestDuration,
  lastfmAlbumCount,
} from '@/lib/metrics';

const CTX = 'AlbumsAPI';

export async function GET(req: NextRequest) {
  const end = apiRequestDuration.startTimer({
    method: 'GET',
    route: '/api/albums',
  });

  const respond = (
    status: number,
    body: Record<string, unknown>,
    headers: Record<string, string> = NO_STORE
  ) => {
    apiRequestCounter.inc({
      method: 'GET',
      route: '/api/albums',
      status_code: status.toString(),
    });
    end();
    return NextResponse.json(body, { status, headers });
  };

  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');
  const period = searchParams.get('period');
  const limitParam = searchParams.get('limit');

  const validLimits = [9, 16, 25];
  const limit = limitParam ? parseInt(limitParam, 10) : 9;

  if (limitParam && !validLimits.includes(limit)) {
    logger.warn(CTX, `Invalid limit: ${limitParam}`);
    return respond(400, { message: 'Invalid limit. Must be 9, 16, or 25.' });
  }

  logger.info(
    CTX,
    `Received request for username: ${username}, period: ${period}, limit: ${limit}`
  );

  if (username && (username.length < 2 || username.length > 50)) {
    logger.warn(CTX, `Invalid username: ${username}`);
    return respond(400, {
      message: 'Invalid username. Must be between 2 and 50 characters.',
    });
  }

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
    return respond(400, { message: 'Invalid period.' });
  }

  logger.info(
    CTX,
    `Username and period passed initial validation for username: ${username}, period: ${period}`
  );

  if (!username || !period) {
    logger.warn(CTX, 'Missing username or period in request');
    return respond(400, { message: 'Username and period are required' });
  }

  // Encode username and period for cache key security
  const encodedUsername = encodeURIComponent(username);
  const encodedPeriod = encodeURIComponent(period);
  const cacheKey = `lastfm:albums:${encodedUsername}:${encodedPeriod}:${limit}:minimized`;

  // Cache lifetimes are plain constants — see lib/config.ts for why these are no
  // longer read from Remote Config.
  const cacheExpirySeconds = albumsTtlSeconds(period);
  const notFoundCacheExpirySeconds = ALBUMS_NOT_FOUND_TTL;

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
    const rawTopAlbums = await getTopAlbums(username, period, limit);
    return transformLastFmResponse(rawTopAlbums);
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
    lastfmAlbumCount.inc(
      { username: username as string, period: period as string },
      lastFmAlbumCount
    );
    // spotifyLinkCount cannot be determined here as MinimizedAlbum does not have spotifyUrl

    logger.info(
      CTX,
      `Metrics for username: ${username}, period: ${period} - Last.fm albums: ${lastFmAlbumCount}`
    );
    logger.info(
      CTX,
      `Successfully fetched ${lastFmAlbumCount} albums for username: ${username}, period: ${period}`
    );

    // No share record is written here. This route is a pure read, which is what
    // makes it CDN-cacheable: it previously minted a unique nanoid per request, so
    // every response body differed and nothing could ever be shared between users.
    // Share records are now created on demand by POST /api/share.
    const albums = data || [];

    if (albums.length === 0) {
      // Negative results get a short edge TTL so a user who has just started
      // scrobbling isn't stuck with an empty grid at the edge.
      return respond(
        200,
        { albums, spotify: {} },
        cacheHeaders({ cdn: ALBUMS_NOT_FOUND_TTL, browser: 0, swr: 600 })
      );
    }

    // Resolved here rather than by the client, which used to fire one request per
    // album after the grid had already rendered. The server has the album list and
    // a warm Spotify token, so it can answer in the same response.
    const { links, complete } = await resolveSpotifyLinks(albums);

    return respond(
      200,
      { albums, spotify: links },
      complete
        ? // Edge TTL deliberately matches the Redis TTL, so the CDN can never
          // serve data older than the origin would have.
          cacheHeaders({ cdn: cacheExpirySeconds, browser: 60, swr: 86400 })
        : // Some links are still unresolved. Cache this only briefly, or a
          // partial answer would be frozen at the edge for the full hour.
          cacheHeaders({ cdn: 30, browser: 0, swr: 60 })
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

    return respond(500, { message: responseMessage, error: errorDetail });
  }
}
