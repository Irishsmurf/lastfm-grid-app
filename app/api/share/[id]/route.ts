import { NextRequest, NextResponse } from 'next/server';
import { redis } from '../../../../lib/redis';
import { SharedGridData } from '../../../../lib/types';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } } // Changed signature to use context
) {
  const { id } = context.params; // Extract id from context.params

  if (!id) {
    return NextResponse.json(
      { message: 'ID parameter is missing' },
      { status: 400 }
    );
  }

  try {
    const result = await redis.get(`share:${id}`);

    if (result) {
      const sharedGridData: SharedGridData = JSON.parse(result);
      return NextResponse.json(sharedGridData, { status: 200 });
    } else {
      return NextResponse.json(
        { message: 'Shared grid not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error retrieving shared grid:', error);
    return NextResponse.json(
      { message: 'Error retrieving shared grid' },
      { status: 500 }
    );
  }
}
