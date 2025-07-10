// app/api/metrics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { registry } from '../../../lib/metrics';

export async function GET(req: NextRequest) {
  const metrics = await registry.metrics();
  return new NextResponse(metrics, {
    status: 200,
    headers: {
      'Content-type': registry.contentType,
    },
  });
}
