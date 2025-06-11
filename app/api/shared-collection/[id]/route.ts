// app/api/shared-collection/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '../../../../../lib/redis'; // Adjust path to your redis instance
import { getFirebaseAdminDb, initializeFirebaseAdmin } from '../../../../../lib/firebase-admin'; // Adjust path
import { Timestamp } from 'firebase-admin/firestore';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ message: 'Collection ID is required' }, { status: 400 });
  }

  const cacheKey = `sharedCollection:${id}`;

  try {
    // 1. Check cache first
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`Returning cached shared collection data for ${cacheKey}`);
      // Data in Redis is stored as JSON string, parse it.
      // Ensure albums and createdAt are handled correctly after parsing.
      const parsedData = JSON.parse(cachedData);
      // Firestore Timestamps are stringified in a specific way by default,
      // or might have been converted to ISO strings before caching.
      // If they were stored as ISO strings or simple objects, direct parsing is fine.
      // If they were full Timestamp objects, client might need to handle that.
      // For simplicity, let's assume they are stored in a client-consumable format (e.g., ISO string).
      return NextResponse.json(parsedData, { status: 200 });
    }

    // 2. If not in cache, fetch from Firebase
    console.log(`Fetching shared collection ${id} from Firebase`);
    initializeFirebaseAdmin(); // Ensure Firebase Admin is initialized
    const db = getFirebaseAdminDb();
    const docRef = db.collection('sharedCollections').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists()) {
      return NextResponse.json({ message: 'Shared collection not found' }, { status: 404 });
    }

    const collectionData = docSnap.data();

    // Prepare data for client and cache. Convert Timestamp to ISO string for consistent JSON serialization.
    // Firestore Timestamps need conversion for reliable JSON stringification and parsing.
    let processedData;
    if (collectionData) {
         processedData = { ...collectionData };
         if (collectionData.createdAt && collectionData.createdAt instanceof Timestamp) {
             processedData.createdAt = collectionData.createdAt.toDate().toISOString();
         }
         // Potentially process other fields if necessary, e.g. nested Timestamps in albums
    }


    // 3. Cache the response (e.g., for 1 hour)
    if (processedData) {
      await redis.setex(cacheKey, 3600, JSON.stringify(processedData));
      console.log(`Shared collection ${id} cached in Redis.`);
    }

    return NextResponse.json(processedData, { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching shared collection ${id}: ${errorMessage}`);
    return NextResponse.json(
      { message: 'Error fetching shared collection', error: errorMessage },
      { status: 500 }
    );
  }
}
