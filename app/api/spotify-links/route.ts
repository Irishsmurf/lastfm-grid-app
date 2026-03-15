import { NextRequest, NextResponse } from 'next/server';
import { searchAlbumsBulk } from '@/lib/spotifyService';
import { logger } from '@/utils/logger';

const CTX = 'SpotifyLinksBulkAPI';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { albums } = body;

    if (!albums || !Array.isArray(albums)) {
      return NextResponse.json(
        { message: 'Missing or invalid required parameter: albums' },
        { status: 400 }
      );
    }

    if (albums.length === 0) {
      return NextResponse.json({}, { status: 200 });
    }

    logger.info(CTX, `Received bulk request for ${albums.length} albums`);

    const results = await searchAlbumsBulk(albums);

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    logger.error(
      CTX,
      `Error in bulk Spotify links API: ${error instanceof Error ? error.message : String(error)}`
    );
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
