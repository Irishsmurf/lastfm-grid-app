import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { redis } from '@/lib/redis';
import { logger } from '@/utils/logger';
import { NO_STORE } from '@/lib/config';
import type { SharedGridData } from '@/lib/types';
import type { MinimizedAlbum } from '@/lib/minimizedLastfmService';
import { apiRequestCounter } from '@/lib/metrics';

const CTX = 'ShareAPI';

const VALID_PERIODS = [
  'overall',
  '7day',
  '1month',
  '3month',
  '6month',
  '12month',
];

/** Grids are at most 25 albums; anything larger is not a grid we produced. */
const MAX_ALBUMS = 25;

function isAlbumShaped(value: unknown): value is MinimizedAlbum {
  if (typeof value !== 'object' || value === null) return false;
  const album = value as Record<string, unknown>;
  return (
    typeof album.name === 'string' &&
    typeof album.artist === 'object' &&
    album.artist !== null &&
    typeof (album.artist as Record<string, unknown>).name === 'string'
  );
}

/**
 * Creates a shareable snapshot of a grid.
 *
 * This used to happen inside GET /api/albums on every request — including cache
 * hits — which minted a permanent Redis key per page view and made that route
 * impossible to cache at the CDN. Creating the record only when a user actually
 * clicks Share bounds Redis growth to real shares and keeps the read path pure.
 */
export async function POST(req: NextRequest) {
  const respond = (status: number, body: Record<string, unknown>) => {
    apiRequestCounter.inc({
      method: 'POST',
      route: '/api/share',
      status_code: status.toString(),
    });
    return NextResponse.json(body, { status, headers: NO_STORE });
  };

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return respond(400, { message: 'Invalid JSON body.' });
  }

  const { username, period, albums } = (payload ?? {}) as {
    username?: unknown;
    period?: unknown;
    albums?: unknown;
  };

  if (
    typeof username !== 'string' ||
    username.length < 2 ||
    username.length > 50
  ) {
    return respond(400, {
      message: 'Invalid username. Must be between 2 and 50 characters.',
    });
  }

  if (typeof period !== 'string' || !VALID_PERIODS.includes(period)) {
    return respond(400, { message: 'Invalid period.' });
  }

  if (!Array.isArray(albums) || albums.length === 0) {
    return respond(400, { message: 'albums must be a non-empty array.' });
  }

  if (albums.length > MAX_ALBUMS) {
    return respond(400, {
      message: `albums must contain at most ${MAX_ALBUMS} entries.`,
    });
  }

  if (!albums.every(isAlbumShaped)) {
    return respond(400, { message: 'albums contains malformed entries.' });
  }

  const sharedId = nanoid();
  const sharedGridData: SharedGridData = {
    id: sharedId,
    username,
    period,
    albums: albums as MinimizedAlbum[],
    createdAt: new Date().toISOString(),
  };

  try {
    // Stored without an expiry so share links never break. This relies on the
    // Redis instance being durable for these keys — configure it for persistence
    // with a volatile-* eviction policy (or no eviction), so permanent share data
    // isn't silently evicted under memory pressure.
    await redis.set(`share:${sharedId}`, JSON.stringify(sharedGridData));
  } catch (redisError) {
    const detail =
      redisError instanceof Error ? redisError.message : String(redisError);
    logger.error(CTX, `Failed to save shared grid for ${username}: ${detail}`);
    return respond(503, {
      message: 'Failed to save share data. Please try again.',
      error: process.env.NODE_ENV === 'production' ? undefined : detail,
    });
  }

  logger.info(CTX, `Saved shared grid ${sharedId} for ${username}/${period}`);
  return respond(201, { sharedId });
}
