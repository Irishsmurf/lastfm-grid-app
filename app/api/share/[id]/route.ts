// app/api/share/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import type { SharedGridData } from '@/lib/types'; // Use 'type' import for interfaces
import { logger } from '@/utils/logger'; // Assuming logger is available

const CTX = 'ShareAPI';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  logger.info(CTX, `Received request for shared grid ID: ${id}`);

  if (!id) {
    logger.warn(CTX, 'Missing ID in request');
    return NextResponse.json({ message: 'ID is required' }, { status: 400 });
  }

  try {
    const data = await redis.get(`sharedGrid:${id}`); // Add a prefix for namespacing in Redis

    if (data) {
      logger.info(CTX, `Found data for ID: ${id}`);
      const sharedGridData: SharedGridData = JSON.parse(data);
      return NextResponse.json(sharedGridData, { status: 200 });
    } else {
      logger.warn(CTX, `No data found for ID: ${id}`);
      return NextResponse.json({ message: 'Grid not found' }, { status: 404 });
    }
  } catch (error) {
    let errorMessage = 'An unexpected error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    logger.error(CTX, `Error fetching shared grid for ID ${id}: ${errorMessage}`, error);
    return NextResponse.json(
      { message: 'Error fetching shared grid', error: errorMessage },
      { status: 500 }
    );
  }
}
