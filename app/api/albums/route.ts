// app/api/albums/route.js

import { NextRequest, NextResponse } from "next/server";
import { redis } from "../../../lib/redis";
import SpotifyWebApi from "spotify-web-api-node";

// Initialize Spotify API client
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

// Function to get Spotify access token
async function getSpotifyAccessToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body["access_token"]);
    console.log("Spotify access token fetched successfully");
  } catch (error) {
    console.error("Error fetching Spotify access token:", error);
    throw new Error("Failed to fetch Spotify access token");
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  const period = searchParams.get("period");

  const cacheKey = `lastfm:${username}:${period}`;

  try {
    // Check cache first
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`Returning cached data for ${cacheKey}`);
      return NextResponse.json(JSON.parse(cachedData), { status: 200 });
    }

    // If not in cache, fetch from LastFM
    console.log(`Fetching data for ${username} - ${period} from LastFM`);
    const response = await fetch(
      `${process.env.LASTFM_BASE_URL}?method=user.gettopalbums&user=${username}&period=${period}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=9`
    );

    if (!response.ok) {
      console.error(
        `Error response from LastFM: ${response.status}:${response.statusText}`
      );
      throw new Error("Failed to fetch from LastFM");
    }

    const data = await response.json();

    // Ensure we have an access token before making Spotify API calls
    if (!spotifyApi.getAccessToken()) {
      await getSpotifyAccessToken();
    }

    // Add Spotify URL to each album
    if (data.topalbums && data.topalbums.album) {
      for (const album of data.topalbums.album) {
        try {
          const spotifySearch = await spotifyApi.searchAlbums(
            `album:${album.name} artist:${album.artist.name}`,
            { limit: 1 }
          );
          if (
            spotifySearch.body.albums &&
            spotifySearch.body.albums.items.length > 0
          ) {
            album.spotifyUrl =
              spotifySearch.body.albums.items[0].external_urls.spotify;
          } else {
            album.spotifyUrl = null;
          }
        } catch (spotifyError) {
          console.error(
            `Error fetching Spotify data for ${album.name} by ${album.artist.name}:`,
            spotifyError
          );
          album.spotifyUrl = null;
        }
      }
    }

    // Cache the response for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(data));

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
        console.log(`Error fetching albums: ${error.message}`);
    } else {
        console.log(`Error fetching albums: ${error}`);
    }

    // Clear access token if it's an auth error to refresh next time
    if (error instanceof Error && error.message.includes("token")) {
        spotifyApi.setAccessToken('');
    }

    // Ensure the error message is properly serialized in the JSON response
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { message: "Error fetching albums", error: { message: errorMessage } },
      { status: 500 }
    );
  }
}
