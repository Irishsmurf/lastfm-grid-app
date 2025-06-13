// app/api/albums/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTopAlbums } from '@/lib/lastfmService';
import {
  transformLastFmResponse,
  MinimizedAlbum,
} from '@/lib/minimizedLastfmService';
import { handleCaching } from '@/lib/cache';
import { logger } from '@/utils/logger';
import { nanoid } from 'nanoid'; // Added
import type { SharedGridData } from '@/lib/types'; // Added
import { redis } from '@/lib/redis'; // Added

const CTX = 'AlbumsAPI';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');
  const period = searchParams.get('period');

  logger.info(
    CTX,
    `Received request for username: ${username}, period: ${period}`
  );

  if (!username || !period) {
    logger.warn(CTX, 'Missing username or period in request');
    return NextResponse.json(
      { message: 'Username and period are required' },
      { status: 400 }
    );
  }

  const cacheKey = `lastfm:albums:${username}:${period}:minimized`;
  const cacheExpirySeconds = 3600; // 1 hour for album data itself
  const notFoundCacheExpirySeconds = 600; // 10 minutes for "not found" album data

  const isResultNotFound = (data: MinimizedAlbum[]): boolean => {
    return !data || data.length === 0;
  };

  const notFoundReturnValue: MinimizedAlbum[] = [];

  const fetchDataFunction = async (): Promise<MinimizedAlbum[]> => {
    logger.info(
      CTX,
      `Fetching fresh data from Last.fm for ${username}, period: ${period}`
    );
    const rawTopAlbums = await getTopAlbums(username, period);
    return transformLastFmResponse(rawTopAlbums);
  };

  try {
    const albumsData = await handleCaching<MinimizedAlbum[]>({ // Renamed to albumsData for clarity
      cacheKey,
      fetchDataFunction,
      cacheExpirySeconds,
      isNotFound: isResultNotFound,
      notFoundValue: notFoundReturnValue,
      notFoundCacheExpirySeconds,
    });

    const lastFmAlbumCount = albumsData ? albumsData.length : 0;
    logger.info(
      CTX,
      `Metrics for username: ${username}, period: ${period} - Last.fm albums: ${lastFmAlbumCount}`
    );

    if (isResultNotFound(albumsData)) {
      logger.info(
        CTX,
        `No albums found for username: ${username}, period: ${period}. Not generating share ID.`
      );
      return NextResponse.json({ albums: albumsData, sharedId: null }, { status: 200 });
    }

    // If albums are found, generate sharedId and store
    const sharedId = nanoid();
    const sharedGridEntry: SharedGridData = {
      id: sharedId,
      username, // username is in scope
      period,   // period is in scope
      albums: albumsData,
      createdAt: new Date().toISOString(),
    };

    const SHARED_GRID_EXPIRY_SECONDS = 2592000; // 30 days
    await redis.setex(
      `sharedGrid:${sharedId}`,
      SHARED_GRID_EXPIRY_SECONDS,
      JSON.stringify(sharedGridEntry)
    );

    logger.info(
      CTX,
      `Successfully fetched ${lastFmAlbumCount} albums and generated sharedId: ${sharedId} for username: ${username}, period: ${period}`
    );
    return NextResponse.json({ albums: albumsData, sharedId }, { status: 200 });

  } catch (error) {
    let errorMessage = 'An unexpected error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    logger.error(CTX, `Error for ${username}/${period}: ${errorMessage}`, error);
    return NextResponse.json(
      { message: 'Error fetching albums', error: errorMessage, albums: [], sharedId: null }, // Ensure consistent error response shape
      { status: 500 }
    );
  }
}
