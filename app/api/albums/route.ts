// app/api/albums/route.js

import { NextRequest, NextResponse } from "next/server";
import { redis } from "../../../lib/redis";

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

    // Cache the response for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(data));

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
        console.log(`Error fetching albums: ${error.message}`);
    } else {
        console.log(`Error fetching albums: ${error}`);
    }

    // Ensure the error message is properly serialized in the JSON response
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { message: "Error fetching albums", error: { message: errorMessage } },
      { status: 500 }
    );
  }
}
