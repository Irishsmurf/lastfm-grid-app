import { NextRequest, NextResponse } from 'next/server';
import { redis } from '../../../../lib/redis'; // Adjusted path for Redis client

interface GetParams {
  params: {
    collectionId: string;
  };
}

export async function GET(request: NextRequest, { params }: GetParams) {
  const { collectionId } = params;

  if (!collectionId) {
    // This case should ideally be handled by Next.js routing if the param is missing in the path structure
    return NextResponse.json({ error: 'Collection ID is required.' }, { status: 400 });
  }

  const redisKey = `sharedCollection:${collectionId}`;

  try {
    const dataString = await redis.get(redisKey);

    if (dataString) {
      try {
        const collection = JSON.parse(dataString);
        return NextResponse.json(collection, { status: 200 });
      } catch (parseError) {
        console.error(`Error parsing JSON for collection ${collectionId}:`, parseError);
        // This indicates corrupted data in Redis
        return NextResponse.json({ error: 'Failed to parse collection data.' }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: 'Collection not found.' }, { status: 404 });
    }
  } catch (redisError) {
    console.error(`Redis error when fetching collection ${collectionId}:`, redisError);
    const errorMessage = redisError instanceof Error ? redisError.message : 'Unknown Redis error';
    return NextResponse.json({ error: `Error retrieving collection from Redis. ${errorMessage}` }, { status: 500 });
  }
}
