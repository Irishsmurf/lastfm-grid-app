import { NextRequest, NextResponse } from 'next/server';
import { searchAlbum } from '@/lib/spotifyService'; // Corrected import path
import { handleCaching } from '@/lib/cache';
import { logger } from '@/utils/logger'; // Import logger
import { initializeRemoteConfig, getRemoteConfigValue } from '@/lib/firebase'; // Added

const CTX = 'SpotifyLinkAPI'; // Context for logger

export async function GET(req: NextRequest) {
  // Initialize Remote Config
  await initializeRemoteConfig(); // Best practice: call this at app startup

  const { searchParams } = new URL(req.url);
  const albumName = searchParams.get('albumName');
  const artistName = searchParams.get('artistName');

  if (!albumName || !artistName) {
    return NextResponse.json(
      {
        message: 'Missing required query parameters: albumName and artistName',
      },
      { status: 400 }
    );
  }

  // Sanitize or encode parts of the cache key if they can contain special characters
  // For simplicity here, assuming they are reasonably clean.
  const safeArtistName = encodeURIComponent(artistName);
  const safeAlbumName = encodeURIComponent(albumName);
  const cacheKey = `spotify:link:${safeArtistName}:${safeAlbumName}`;

  // Get cache expiry values from Remote Config
  const defaultCacheExpirySeconds = 86400; // 24 hours
  const defaultNotFoundCacheExpirySeconds = 3600; // 1 hour

  let cacheExpirySeconds = defaultCacheExpirySeconds;
  try {
    const remoteCacheExpiry = getRemoteConfigValue(
      'spotify_cache_expiry_seconds'
    ).asNumber();
    if (remoteCacheExpiry > 0) {
      cacheExpirySeconds = remoteCacheExpiry;
    }
  } catch (error) {
    logger.warn(
      CTX,
      `Failed to get 'spotify_cache_expiry_seconds' from Remote Config or invalid value. Using default: ${defaultCacheExpirySeconds}s. Error: ${error instanceof Error ? error.message : String(error)}`
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

  const notFoundRedisPlaceholder = 'SPOTIFY_NOT_FOUND'; // Specific placeholder

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
    console.log(
      `Fetching fresh Spotify link for album: ${albumName}, artist: ${artistName}`
    );
    // The searchAlbum function from spotifyService should handle its own errors,
    // potentially throwing specific errors for auth failures.
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
    return NextResponse.json(result, { status: 200 });
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
        { status: statusCode }
      );
    } else {
      // In development/other, include more details
      return NextResponse.json(
        { message: clientResponseMessage, error: detailedErrorMessage },
        { status: statusCode }
      );
    }
  }
}
