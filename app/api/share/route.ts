import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { redis } from '../../../lib/redis'; // Import actual Redis client

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, period, title, description } = body;

    if (!username || !period || !title) {
      return NextResponse.json({ error: 'Missing required parameters: username, period, and title are required.' }, { status: 400 });
    }

    // 1. Generate a unique ID for the collection
    const collectionId = randomUUID();

    // 2. Fetch album data from Last.fm
    let albumsData;
    try {
      const lastFmUrl = `${process.env.LASTFM_BASE_URL}?method=user.gettopalbums&user=${username}&period=${period}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=9`;
      const lastFmResponse = await fetch(lastFmUrl);

      if (!lastFmResponse.ok) {
        const errorText = await lastFmResponse.text();
        console.error(
          `Last.fm API error: ${lastFmResponse.status} ${lastFmResponse.statusText}, Response: ${errorText}`
        );
        return NextResponse.json(
          { error: 'Failed to fetch album data from Last.fm.' },
          { status: 502 } // 502 Bad Gateway for upstream error
        );
      }

      const lastFmData = await lastFmResponse.json();

      // Check for Last.fm specific API errors in the response body
      if (lastFmData.error) {
        console.error(`Last.fm API returned an error: ${lastFmData.message}`);
        return NextResponse.json(
          { error: `Last.fm API error: ${lastFmData.message}` },
          { status: 502 }
        );
      }

      // Ensure the expected data structure exists
      if (!lastFmData.topalbums || !Array.isArray(lastFmData.topalbums.album)) {
        console.error('Unexpected data structure from Last.fm:', lastFmData);
        return NextResponse.json({ error: 'Unexpected data structure from Last.fm.' }, { status: 500 });
      }

      albumsData = lastFmData.topalbums.album;

    } catch (fetchError) {
      console.error('Error fetching from Last.fm:', fetchError);
      // Check if the error is a FetchError or similar network issue
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
      return NextResponse.json({ error: `Failed to communicate with Last.fm API. ${errorMessage}` }, { status: 503 }); // Service Unavailable
    }

    // 3. Construct the shared collection object
    const createdAt = new Date().toISOString();
    const sharedCollection = {
      id: collectionId,
      username,
      period, // e.g., '7day', '1month', '3month', '6month', '12month', 'overall'
      title,
      description: description || '', // Optional description
      albumsData, // Now contains actual data from Last.fm
      createdAt,
    };

    // 4. Store this object as a JSON string in Redis
    const redisKey = `sharedCollection:${collectionId}`;
    try {
      // Using the actual redis client
      // Set without expiry for now, or use setex for expiry
      await redis.set(redisKey, JSON.stringify(sharedCollection));
    } catch (redisError) {
      console.error('Redis error:', redisError);
      const errorMessage = redisError instanceof Error ? redisError.message : 'Unknown Redis error';
      return NextResponse.json({ error: `Failed to store collection data. ${errorMessage}` }, { status: 500 });
    }

    // 5. Return a JSON response
    return NextResponse.json(
      {
        message: 'Shared collection created successfully.',
        collectionId,
        // For debugging/testing, you might want to return the created object
        // collection: sharedCollection,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error processing POST request:', error);
    if (error instanceof SyntaxError) { // Handle JSON parsing errors
        return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

// Optional: Add a GET handler or other methods if needed in the future
// export async function GET(request: NextRequest) {
//   // ...
// }
