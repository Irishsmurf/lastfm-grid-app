import { NextRequest, NextResponse } from 'next/server';
import { getTopAlbums, LastFmTopAlbumsResponse } from '@/lib/lastfmService'; // Imported LastFmTopAlbumsResponse
import { handleCaching } from '@/lib/cache';
// import { redis } from '@/lib/redis'; // Removed unused import

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');
  const period = searchParams.get('period');

  if (!username || !period) {
    return NextResponse.json(
      { message: 'Username and period are required' },
      { status: 400 }
    );
  }

  const cacheKey = `lastfm:albums:${username}:${period}`;
  const cacheExpirySeconds = 3600; // 1 hour
  const notFoundCacheExpirySeconds = 600; // 10 minutes

  // This is what Last.fm returns for a valid user but no albums in the period (or an invalid user)
  // It's an empty 'topalbums' object or an error object.
  // We will specifically check for the album array.
  // Type for data can be LastFmTopAlbumsResponse or a Last.fm error object structure
  const isResultNotFound = (
    data: LastFmTopAlbumsResponse | { error?: number; message?: string }
  ): boolean => {
    if (data && 'error' in data && data.error) {
      // Last.fm API error encoded in response
      return true;
    }
    // Check if it's LastFmTopAlbumsResponse and if albums array is empty or missing
    const topAlbumsData = data as LastFmTopAlbumsResponse;
    return !topAlbumsData?.topalbums?.album?.length;
  };

  // The value to return if the isResultNotFound condition is met by fetchDataFunction,
  // or if the notFoundRedisPlaceholder is retrieved from cache.
  // For Last.fm, an empty album list within the structure is appropriate.
  const notFoundReturnValue = {
    topalbums: {
      album: [],
      '@attr': {
        user: username,
        period: period,
        totalPages: '0',
        page: '1',
        perPage: '9', // Assuming default limit, adjust if dynamic
        total: '0',
      },
    },
  };

  const fetchDataFunction = async () => {
    console.log(
      `Fetching fresh data from Last.fm for ${username}, period ${period}`
    );
    // The getTopAlbums function itself handles Last.fm API errors (like invalid user)
    // and should return a structure that isNotFound can evaluate.
    // Default limit is 9 in getTopAlbums, can be passed if made dynamic here.
    return getTopAlbums(username, period);
  };

  try {
    const data = await handleCaching({
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
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    let errorMessage = 'An unexpected error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    console.error(`[API ALBUMS ROUTE] Error for ${username}/${period}:`, error);
    return NextResponse.json(
      { message: 'Error fetching albums', error: errorMessage },
      { status: 500 }
    );
  }
}
