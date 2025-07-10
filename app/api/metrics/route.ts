// app/api/metrics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { registry } from '../../../lib/metrics';
import { logger } from '@/utils/logger';
const CTX = 'MetricsAPI';

export async function GET(_req: NextRequest) {
  logger.info(CTX, 'Received request for metrics');
  const metrics = await registry.metrics();
  return new NextResponse(metrics, {
    status: 200,
    headers: {
      'Content-type': registry.contentType,
    },
  });
}
