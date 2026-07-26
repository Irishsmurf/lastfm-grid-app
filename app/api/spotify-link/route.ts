import { NextRequest, NextResponse } from 'next/server';
import {
  searchAlbum,
  spotifyLinkCacheKey,
  SPOTIFY_NOT_FOUND_PLACEHOLDER,
} from '@/lib/spotifyService';
import { handleCaching } from '@/lib/cache';
import { logger } from '@/utils/logger'; // Import logger
import {
  SPOTIFY_LINK_TTL,
  SPOTIFY_NOT_FOUND_TTL,
  cacheHeaders,
  NO_STORE,
} from '@/lib/config';

const CTX = 'SpotifyLinkAPI'; // Context for logger

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const albumName = searchParams.get('albumName');
  const artistName = searchParams.get('artistName');

  if (!albumName || !artistName) {
    return NextResponse.json(
      {
        message: 'Missing required query parameters: albumName and artistName',
      },
      { status: 400, headers: NO_STORE }
    );
  }

  // Shared with the batch resolver in lib/spotifyService.ts so both paths hit the
  // same cache entries.
  const cacheKey = spotifyLinkCacheKey(artistName, albumName);

  // Cache lifetimes are plain constants — see lib/config.ts.
  const cacheExpirySeconds = SPOTIFY_LINK_TTL;
  const notFoundCacheExpirySeconds = SPOTIFY_NOT_FOUND_TTL;

  const notFoundRedisPlaceholder = SPOTIFY_NOT_FOUND_PLACEHOLDER;

  // Define how to check if the fetched data means "not found"
  const isResultNotFound = (
    data: { spotifyUrl: string | null } | null
  ): boolean => {
    return data?.spotifyUrl === null;
  };

  // Define the value to return when "not found" (either from cache placeholder or fresh fetch)
  const notFoundReturnValue = { spotifyUrl: null };

  // Define the function that fetches fresh data
  const fetchDataFunction = async () => {
    logger.info(
      CTX,
      `Fetching fresh Spotify link for album: ${albumName}, artist: ${artistName}`
    );
    return searchAlbum(albumName, artistName);
  };

  try {
    const result = await handleCaching({
      cacheKey,
      fetchDataFunction,
      cacheExpirySeconds,
      isNotFound: isResultNotFound,
      notFoundValue: notFoundReturnValue,
      notFoundCacheExpirySeconds,
      notFoundRedisPlaceholder,
    });

    // The client expects a 200 OK even if spotifyUrl is null
    const found = result?.spotifyUrl != null;
    return NextResponse.json(result, {
      status: 200,
      headers: found
        ? // An album -> Spotify URL mapping is effectively immutable, and popular
          // albums recur across users, so this endpoint gets a high cross-user
          // edge hit rate.
          cacheHeaders({
            cdn: SPOTIFY_LINK_TTL,
            browser: 86400,
            swr: 2592000,
          })
        : cacheHeaders({ cdn: 3600, browser: 0, swr: 86400 }),
    });
  } catch (error) {
    let statusCode = 500;
    let clientResponseMessage: string;
    let detailedErrorMessage = 'An unexpected error occurred.';

    if (error instanceof Error) {
      detailedErrorMessage = error.message;
      if (error.message.includes('Spotify access token')) {
        statusCode = 503; // Service Unavailable
        clientResponseMessage =
          'Error with Spotify authentication. Please try again later.';
      } else {
        clientResponseMessage =
          'An error occurred while processing your request for a Spotify link.';
      }
    } else {
      detailedErrorMessage = String(error);
      clientResponseMessage =
        'An unexpected error occurred while processing your request.';
    }

    logger.error(
      CTX,
      `Error for ${artistName} - ${albumName}: ${detailedErrorMessage}: ${error}`
    );

    // For production, always use a generic message unless it's a specific case like auth
    if (process.env.NODE_ENV === 'production') {
      if (statusCode !== 503) {
        // If not the specific Spotify auth error
        clientResponseMessage = 'An internal server error occurred.';
      }
      // Do not send detailed error message to client in production
      return NextResponse.json(
        { message: clientResponseMessage },
        { status: statusCode, headers: NO_STORE }
      );
    } else {
      // In development/other, include more details
      return NextResponse.json(
        { message: clientResponseMessage, error: detailedErrorMessage },
        { status: statusCode, headers: NO_STORE }
      );
    }
  }
}
