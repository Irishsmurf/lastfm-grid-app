import { NextRequest, NextResponse } from 'next/server';
import { redis } from '../../../../lib/redis';
import { SharedGridData } from '../../../../lib/types';
import { logger } from '../../../../utils/logger';
import { cacheHeaders, NO_STORE } from '../../../../lib/config';

const CTX = 'ShareAPI';

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: Context // Changed signature to use new Context interface
) {
  const { id } = await context.params; // Await context.params

  if (!id) {
    return NextResponse.json(
      { message: 'ID parameter is missing' },
      { status: 400, headers: NO_STORE }
    );
  }

  try {
    const result = await redis.get(`share:${id}`);

    if (result) {
      const sharedGridData: SharedGridData = JSON.parse(result);
      // A share record is an immutable snapshot under a unique id, so this is the
      // most cacheable response in the app — a viral link collapses to roughly one
      // origin hit regardless of how many people open it.
      return NextResponse.json(sharedGridData, {
        status: 200,
        headers: cacheHeaders({
          cdn: 31536000,
          browser: 3600,
          immutable: true,
        }),
      });
    } else {
      // Only briefly, so an id that is about to be created isn't negatively
      // cached at the edge.
      return NextResponse.json(
        { message: 'Shared grid not found' },
        { status: 404, headers: cacheHeaders({ cdn: 60, browser: 0 }) }
      );
    }
  } catch (error) {
    logger.error(
      CTX,
      `Error retrieving shared grid: ${error instanceof Error ? error.message : String(error)}`
    );
    return NextResponse.json(
      { message: 'Error retrieving shared grid' },
      { status: 500, headers: NO_STORE }
    );
  }
}
