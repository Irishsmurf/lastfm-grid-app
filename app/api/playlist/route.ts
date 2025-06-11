// app/api/playlist/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  getUserAuthorizedSpotifyApi,
  getAuthorizationUrl,
  searchAlbums,
  getAlbumTracks,
  getTracksDetails, // To get track popularity
  getCurrentUserProfile,
  createPlaylist,
  addTracksToPlaylist,
  clearUserTokens // For explicit sign-out or token error handling
} from '@/lib/spotify'; // Assuming lib is aliased to @/lib
// Default import for the class, types are typically global via @types
import SpotifyWebApi from 'spotify-web-api-node';

// Define a type for Spotify API-like errors
interface SpotifyApiError { // Keep this for error handling
  body?: {
    error?: {
      message: string;
      status?: number; // Sometimes status is here
    };
  };
  statusCode?: number;
  message?: string; // Fallback for general errors
}

// Helper to check if an error is a SpotifyApiError
function isSpotifyApiError(error: unknown): error is SpotifyApiError {
  if (typeof error !== 'object' || error === null) return false;
  const err = error as SpotifyApiError;
  return (
    (typeof err.statusCode === 'number') &&
    (typeof err.body?.error?.message === 'string')
  );
}

// Define a general structure for successful Spotify API responses
// This helps in type-casting results from mocked functions if full types are problematic
interface SpotifySuccessResponse<T> {
  body: T;
  headers: Record<string, string>;
  statusCode: number;
}

interface AlbumInput {
  albumName: string;
  artistName: string;
}

// A simple session management placeholder - replace with your actual session logic
// For example, using cookies or a session library
function getSessionId(_req: NextRequest): string | null {
  // Example: Read a session ID from a custom header or a secure cookie
  // For demonstration, let's assume it's passed as a query parameter or a known value
  // IMPORTANT: In production, use a secure method like httpOnly, secure cookies.
  // const sessionId = req.cookies.get('session_id')?.value;
  // return sessionId || 'test-session-id'; // Fallback for now

  // Using a static session ID for now as per previous setup.
  // This needs to be replaced with actual session management.
  return 'test-session-id';
}


export async function POST(req: NextRequest) {
  console.log("Playlist creation request received (v2 - using spotify.ts)");

  const sessionId = getSessionId(req);
  if (!sessionId) {
    return NextResponse.json({ message: 'Session not found. Please ensure you are logged in or have a valid session.' }, { status: 400 });
  }

  try {
    const body = await req.json();

    if (!body || !body.albums || !Array.isArray(body.albums) || body.albums.length === 0) {
      return NextResponse.json({ message: 'Missing or invalid albums data in request body. Expected an array of { albumName, artistName }.' }, { status: 400 });
    }
    const albums: AlbumInput[] = body.albums;

    const spotifyApi = await getUserAuthorizedSpotifyApi(sessionId);

    if (!spotifyApi) {
      // No valid token, or refresh failed. User needs to (re-)authorize.
      const authorizeURL = getAuthorizationUrl(sessionId); // Pass sessionId as state
      console.log(`No valid Spotify token for session ${sessionId}. Redirecting to Spotify auth: ${authorizeURL}`);
      return NextResponse.json({ authorizeURL }, { status: 401 });
    }

    console.log(`Processing ${albums.length} albums for playlist creation using spotify.ts.`);

    let allSelectedTrackUris: string[] = [];
    const processedAlbumsDetails: any[] = [];

    for (const albumInput of albums) {
      try {
        console.log(`Searching for album: ${albumInput.albumName} by ${albumInput.artistName}`);
        const searchResults = await searchAlbums(spotifyApi, albumInput.albumName, albumInput.artistName, 1);

        if (searchResults.body.albums && searchResults.body.albums.items.length > 0) {
          const spotifyAlbum = searchResults.body.albums.items[0];
          console.log(`Found album: ${spotifyAlbum.name}, ID: ${spotifyAlbum.id}`);

          const tracksResponse = await getAlbumTracks(spotifyApi, spotifyAlbum.id, 50); // Get up to 50 tracks
          let albumTracks = tracksResponse.body.items;

          // Fetch full track details to get popularity
          const trackIds = albumTracks.map(t => t.id).filter(id => id); // Filter out null/undefined IDs
          if (trackIds.length > 0) {
            // Types from spotify-web-api-node are typically in the global SpotifyApi namespace
            const detailedTracks: SpotifyApi.TrackObjectFull[] = await getTracksDetails(spotifyApi, trackIds);
            // Sort tracks by popularity (descending). Tracks without popularity are ranked lower.
            detailedTracks.sort((a: SpotifyApi.TrackObjectFull, b: SpotifyApi.TrackObjectFull) =>
              Number(b.popularity || 0) - Number(a.popularity || 0)
            );
            albumTracks = detailedTracks; // Now using sorted, detailed tracks
          }

          // Select top N tracks (e.g., up to 3, or more sophisticated weighting)
          const selectedTracks = albumTracks.slice(0, 3).map(track => track.uri).filter(uri => uri); // Ensure URI is valid

          if (selectedTracks.length > 0) {
             allSelectedTrackUris.push(...selectedTracks);
            processedAlbumsDetails.push({
              name: spotifyAlbum.name,
              artist: albumInput.artistName,
              id: spotifyAlbum.id,
              selectedTrackUris: selectedTracks,
              // Add popularity of selected tracks for more info if needed
              selectedTracksDetails: albumTracks.slice(0, 3).map(t => ({
                name: t.name,
                popularity: ('popularity' in t && typeof t.popularity === 'number') ? t.popularity : 0
              })),
            });
            console.log(`Selected ${selectedTracks.length} tracks from ${spotifyAlbum.name} based on popularity.`);
          } else {
            console.log(`No tracks selected from ${spotifyAlbum.name} after filtering.`);
          }
        } else {
          console.log(`Album ${albumInput.albumName} by ${albumInput.artistName} not found on Spotify.`);
        }
      } catch (albumError: unknown) {
        let errorMessage = 'Unknown error during album processing';
        if (isSpotifyApiError(albumError) && albumError.body?.error?.message) {
          errorMessage = albumError.body.error.message;
        } else if (albumError instanceof Error) {
          errorMessage = albumError.message;
        }
        console.error(`Error processing album ${albumInput.albumName}:`, errorMessage);
        // Optionally skip this album and continue, or bail out
      }
    }

    if (allSelectedTrackUris.length === 0) {
      return NextResponse.json({ message: 'No tracks found for the given albums to create a playlist.' }, { status: 404 });
    }
    allSelectedTrackUris = [...new Set(allSelectedTrackUris)]; // Remove duplicate track URIs if any

    // Create a new private playlist
    const userProfile = await getCurrentUserProfile(spotifyApi);
    const userId = userProfile.body.id;
    const playlistName = `My Awesome Mix - ${new Date().toLocaleDateString()}`;
    const playlistDescription = 'Generated from your top albums, weighted by popularity.';

    const createPlaylistResponse = await createPlaylist(spotifyApi, userId, playlistName, playlistDescription, false) as SpotifySuccessResponse<SpotifyApi.CreatePlaylistResponse>;
    const playlistId = createPlaylistResponse.body.id;
    const playlistUrl = createPlaylistResponse.body.external_urls.spotify;

    console.log(`Created playlist: ${playlistName}, ID: ${playlistId}`);

    // Add tracks to the playlist (max 100 per call, handled by addTracksToPlaylist)
    if (allSelectedTrackUris.length > 0) {
      await addTracksToPlaylist(spotifyApi, playlistId, allSelectedTrackUris);
      console.log(`Added ${allSelectedTrackUris.length} unique tracks to the playlist.`);
    }

    return NextResponse.json({
        message: 'Playlist created successfully with popularity weighting!',
        playlistUrl: playlistUrl,
        playlistId: playlistId,
        details: processedAlbumsDetails
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error during playlist creation (v2):', error);

    if (isSpotifyApiError(error)) {
      if (error.statusCode === 401 || error.statusCode === 403) {
        await clearUserTokens(sessionId);
        const authorizeURL = getAuthorizationUrl(sessionId);
        return NextResponse.json({
          message: 'Spotify authorization error. Please re-authorize.',
          authorizeURL: authorizeURL,
          error: error.body?.error, // error.body and error.body.error are checked by isSpotifyApiError
        }, { status: error.statusCode });
      }
      return NextResponse.json({
        message: `Spotify API Error: ${error.body?.error?.message || 'Unknown Spotify error'}`,
        details: error.body?.error,
      }, { status: error.statusCode });
    }

    // Generic error
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Error creating playlist.', error: errorMessage }, { status: 500 });
  }
}
