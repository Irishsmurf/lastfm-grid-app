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

interface AlbumInput {
  albumName: string;
  artistName: string;
}

// A simple session management placeholder - replace with your actual session logic
// For example, using cookies or a session library
function getSessionId(req: NextRequest): string | null {
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
    const albums: AlbumInput[] = body.albums;

    if (!albums || !Array.isArray(albums) || albums.length === 0) {
      return NextResponse.json({ message: 'Missing or invalid albums data. Expected an array of { albumName, artistName }.' }, { status: 400 });
    }

    const spotifyApi = await getUserAuthorizedSpotifyApi(sessionId);

    if (!spotifyApi) {
      // No valid token, or refresh failed. User needs to (re-)authorize.
      const authorizeURL = getAuthorizationUrl(sessionId); // Pass sessionId as state
      console.log(\`No valid Spotify token for session \${sessionId}. Redirecting to Spotify auth: \${authorizeURL}\`);
      return NextResponse.json({ authorizeURL }, { status: 401 });
    }

    console.log(\`Processing \${albums.length} albums for playlist creation using spotify.ts.\`);

    let allSelectedTrackUris: string[] = [];
    const processedAlbumsDetails: any[] = [];

    for (const albumInput of albums) {
      try {
        console.log(\`Searching for album: \${albumInput.albumName} by \${albumInput.artistName}\`);
        const searchResults = await searchAlbums(spotifyApi, albumInput.albumName, albumInput.artistName, 1);

        if (searchResults.body.albums && searchResults.body.albums.items.length > 0) {
          const spotifyAlbum = searchResults.body.albums.items[0];
          console.log(\`Found album: \${spotifyAlbum.name}, ID: \${spotifyAlbum.id}\`);

          const tracksResponse = await getAlbumTracks(spotifyApi, spotifyAlbum.id, 50); // Get up to 50 tracks
          let albumTracks = tracksResponse.body.items;

          // Fetch full track details to get popularity
          const trackIds = albumTracks.map(t => t.id).filter(id => id); // Filter out null/undefined IDs
          if (trackIds.length > 0) {
            const detailedTracks = await getTracksDetails(spotifyApi, trackIds);
            // Sort tracks by popularity (descending). Tracks without popularity are ranked lower.
            detailedTracks.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
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
              selectedTracksDetails: albumTracks.slice(0, 3).map(t => ({ name: t.name, popularity: t.popularity})),
            });
            console.log(\`Selected \${selectedTracks.length} tracks from \${spotifyAlbum.name} based on popularity.\`);
          } else {
            console.log(\`No tracks selected from \${spotifyAlbum.name} after filtering.\`);
          }
        } else {
          console.log(\`Album \${albumInput.albumName} by \${albumInput.artistName} not found on Spotify.\`);
        }
      } catch (albumError: any) {
        console.error(\`Error processing album \${albumInput.albumName}:\`, albumError.body ? albumError.body.error : albumError.message);
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
    const playlistName = \`My Awesome Mix - \${new Date().toLocaleDateString()}\`;
    const playlistDescription = 'Generated from your top albums, weighted by popularity.';

    const createPlaylistResponse = await createPlaylist(spotifyApi, userId, playlistName, playlistDescription, false);
    const playlistId = createPlaylistResponse.body.id;
    const playlistUrl = createPlaylistResponse.body.external_urls.spotify;

    console.log(\`Created playlist: \${playlistName}, ID: \${playlistId}\`);

    // Add tracks to the playlist (max 100 per call, handled by addTracksToPlaylist)
    if (allSelectedTrackUris.length > 0) {
      await addTracksToPlaylist(spotifyApi, playlistId, allSelectedTrackUris);
      console.log(\`Added \${allSelectedTrackUris.length} unique tracks to the playlist.\`);
    }

    return NextResponse.json({
        message: 'Playlist created successfully with popularity weighting!',
        playlistUrl: playlistUrl,
        playlistId: playlistId,
        details: processedAlbumsDetails
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error during playlist creation (v2):', error);
    // Check if it's a Spotify API error with a status code
    if (error.body && error.body.error && error.statusCode) {
        // If token was invalid/expired and refresh failed, getUserAuthorizedSpotifyApi would return null
        // and we'd redirect to auth. This error is more likely other API issues.
        // If it's 401/403 here, it might be an issue with scopes or token permissions.
        if (error.statusCode === 401 || error.statusCode === 403) {
            // Token might have been revoked externally or scopes are insufficient
            // Clearing the token prompts for re-authorization on next attempt.
            await clearUserTokens(sessionId);
             const authorizeURL = getAuthorizationUrl(sessionId);
             return NextResponse.json({
                message: 'Spotify authorization error. Please re-authorize.',
                authorizeURL: authorizeURL,
                error: error.body.error
            }, { status: error.statusCode });
        }
        return NextResponse.json({
            message: \`Spotify API Error: \${error.body.error.message}\`,
            details: error.body.error
        }, { status: error.statusCode });
    }
    // Generic error
    return NextResponse.json({ message: 'Error creating playlist.', error: String(error) }, { status: 500 });
  }
}
