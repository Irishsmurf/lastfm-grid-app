import { NextRequest, NextResponse } from 'next/server';
import { getTopAlbums } from '@/lib/lastfmService'; // Keep LastFmTopAlbumsResponse if still needed for raw fetch
import {
  transformLastFmResponse,
  MinimizedAlbum,
} from '@/lib/minimizedLastfmService'; // Added
import { handleCaching } from '@/lib/cache';
import logger from '../../../../utils/logger';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');
  const period = searchParams.get('period');

  logger.info("app/api/albums/route.ts", `Received request for username: ${username}, period: ${period}`);

  if (!username || !period) {
    logger.warn("app/api/albums/route.ts", "Missing username or period in request");
    return NextResponse.json(
      { message: 'Username and period are required' },
      { status: 400 }
    );
  }

  const cacheKey = `lastfm:albums:${username}:${period}:minimized`; // Consider updating cache key
  const cacheExpirySeconds = 3600; // 1 hour
  const notFoundCacheExpirySeconds = 600; // 10 minutes

  const isResultNotFound = (data: MinimizedAlbum[]): boolean => {
    // Updated type and logic
    return !data || data.length === 0;
  };

  const notFoundReturnValue: MinimizedAlbum[] = []; // Updated

  const fetchDataFunction = async (): Promise<MinimizedAlbum[]> => {
    // Updated return type
    logger.info("app/api/albums/route.ts", `Fetching fresh data from Last.fm for ${username}, period ${period}`);
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
    const lastFmAlbumCount = data.length;
    const spotifyLinkCount = data.filter(album => album.spotifyUrl).length;

    logger.info("app/api/albums/route.ts", `Metrics for username: ${username}, period: ${period} - Last.fm albums: ${lastFmAlbumCount}, Spotify links: ${spotifyLinkCount}`);
    logger.info("app/api/albums/route.ts", `Successfully fetched ${lastFmAlbumCount} albums for username: ${username}, period: ${period}`);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    let errorMessage = 'An unexpected error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    logger.error("app/api/albums/route.ts", `Error for ${username}/${period}: ${errorMessage}`);
    return NextResponse.json(
      { message: 'Error fetching albums', error: errorMessage },
      { status: 500 }
    );
  }
}
