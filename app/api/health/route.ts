import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { logger } from '@/utils/logger';

const CTX = 'HealthAPI';

export async function GET() {
  try {
    await redis.ping();
    return NextResponse.json({ status: 'ok', redis: 'connected' }, { status: 200 });
  } catch (error) {
    logger.error(CTX, `Redis health check failed: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ status: 'degraded', redis: 'error' }, { status: 503 });
  }
}
