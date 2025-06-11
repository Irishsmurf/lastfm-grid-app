// app/api/spotify-link/route.ts

import { NextRequest, NextResponse } from 'next/server';
import SpotifyWebApi from 'spotify-web-api-node';

// Initialize Spotify API client
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

// In-memory cache for the access token
let accessToken: string | null = null;
let tokenExpiryTime: number = 0;

async function refreshSpotifyToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    accessToken = data.body['access_token'];
    // Spotify tokens usually expire in 1 hour (3600 seconds)
    // Set expiry time slightly earlier to be safe, e.g., 55 minutes
    tokenExpiryTime = Date.now() + data.body['expires_in'] * 1000 - 5 * 60 * 1000;
    spotifyApi.setAccessToken(accessToken);
    // console.log('Spotify access token refreshed successfully.'); // Debug
  } catch (error) {
    // console.error('Error refreshing Spotify access token:', error); // Debug
    accessToken = null; // Clear token on error
    tokenExpiryTime = 0;
    // Use a very specific error message for this re-throw
    throw new Error('AUTH_TOKEN_REFRESH_FAILED_SPOTIFY');
  }
}

async function getValidAccessToken() {
  if (!accessToken || Date.now() >= tokenExpiryTime) {
    await refreshSpotifyToken();
  }
  return accessToken;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const albumName = searchParams.get('albumName');
  const artistName = searchParams.get('artistName');

  if (!albumName || !artistName) {
    return NextResponse.json(
      { message: 'Missing required query parameters: albumName and artistName' },
      { status: 400 }
    );
  }

  try {
    await getValidAccessToken(); // Ensures token is valid and set

    // Query Spotify API
    // Example: "album:Arrival artist:ABBA"
    const query = `album:${albumName} artist:${artistName}`;
    const searchResponse = await spotifyApi.searchAlbums(query, { limit: 1 });

    if (searchResponse.body.albums && searchResponse.body.albums.items.length > 0) {
      const spotifyUrl = searchResponse.body.albums.items[0].external_urls.spotify;
      return NextResponse.json({ spotifyUrl }, { status: 200 });
    } else {
      return NextResponse.json(
        { spotifyUrl: null, message: 'Album not found on Spotify' },
        { status: 200 } // Changed to 200 as per instruction for client simplicity
      );
    }
  } catch (error: any) {
    // console.error('Error fetching Spotify link:', error); // Debug

    let statusCode = 500;
    let message = 'Internal Server Error while fetching Spotify link.';

    // Check for the specific error thrown by our token refresh logic
    if (error instanceof Error && error.message === 'AUTH_TOKEN_REFRESH_FAILED_SPOTIFY') {
        accessToken = null;
        tokenExpiryTime = 0;
        statusCode = 503;
        message = 'Error with Spotify authentication. Please try again.';
    } else if (error.statusCode && typeof error.statusCode === 'number') {
        // Handle errors that might come directly from spotifyApi.searchAlbums() if they have a statusCode
        statusCode = error.statusCode;
        message = error.body?.error?.message || error.message || 'Spotify API error.';
    }

    return NextResponse.json(
      { message, error: error.message || String(error) },
      { status: statusCode }
    );
  }
}
