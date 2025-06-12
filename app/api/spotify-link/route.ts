import { NextRequest, NextResponse } from 'next/server';
import { searchAlbum } from '@/lib/spotifyService'; // Corrected import path
import { handleCaching } from '@/lib/cache';

export async function GET(req: NextRequest) {
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

  const cacheExpirySeconds = 86400; // 24 hours
  const notFoundCacheExpirySeconds = 3600; // 1 hour
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
    let responseMessage = 'Internal Server Error while fetching Spotify link.';
    let logErrorMessage = 'An unexpected error occurred.';

    if (error instanceof Error) {
      logErrorMessage = error.message;
      // Check for a specific error message or type that spotifyService might throw for auth issues
      // For example, if spotifyService throws new Error('Failed to refresh Spotify access token')
      if (error.message.includes('Spotify access token')) {
        // Make this check more robust if needed
        statusCode = 503; // Service Unavailable
        responseMessage =
          'Error with Spotify authentication. Please try again later.';
      } else {
        // For other errors, use a generic message for the client but log the specific one.
        responseMessage =
          'An error occurred while processing your request for a Spotify link.';
      }
    } else {
      logErrorMessage = String(error);
    }

    console.error(
      `[API SPOTIFY-LINK ROUTE] Error for ${artistName} - ${albumName}: ${logErrorMessage}`,
      error
    );

    return NextResponse.json(
      { message: responseMessage, error: logErrorMessage }, // Provide error detail in non-prod for easier debugging if desired
      { status: statusCode }
    );
  }
}
