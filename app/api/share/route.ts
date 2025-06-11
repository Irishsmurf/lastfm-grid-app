// app/api/share/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '../../../lib/redis';
import { getFirebaseAdminDb, initializeFirebaseAdmin } from '../../../lib/firebase-admin'; // Updated import
import { FieldValue } from 'firebase-admin/firestore'; // For serverTimestamp

// Helper to generate unique IDs (Firestore can do this, but if you want custom format or pre-defined ID)
// const generateUniqueId = () => { /* ... */ }; // Keep if needed, or remove if using Firestore auto-IDs

export async function POST(req: NextRequest) {
  try {
    initializeFirebaseAdmin(); // Ensure Firebase Admin is initialized at the start of the request
    const db = getFirebaseAdminDb();

    const body = await req.json();
    const { username, timeRange, title, description } = body;

    if (!username || !timeRange || !title) {
      return NextResponse.json({ message: 'Missing required fields: username, timeRange, title' }, { status: 400 });
    }

    const cacheKey = `lastfm:${username}:${timeRange}`;
    let albumsData;
    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        albumsData = JSON.parse(cachedData);
      } else {
        const response = await fetch(
          `${process.env.LASTFM_BASE_URL}?method=user.gettopalbums&user=${username}&period=${timeRange}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=9`
        );
        if (!response.ok) throw new Error(`Failed to fetch from LastFM: ${response.statusText}`);
        albumsData = await response.json();
        await redis.setex(cacheKey, 3600, JSON.stringify(albumsData));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ message: 'Error fetching album data for sharing', error: errorMessage }, { status: 500 });
    }

    if (!albumsData || !albumsData.topalbums || !albumsData.topalbums.album) {
      return NextResponse.json({ message: 'No album data found' }, { status: 404 });
    }
    const albums = albumsData.topalbums.album.slice(0, 9);

    // Use Firestore's auto-generated ID
    const collectionRef = db.collection('sharedCollections');
    const newDocRef = collectionRef.doc(); // Creates a new doc reference with an auto-generated ID
    const uniqueId = newDocRef.id;

    const sharedCollectionData = {
      // id: uniqueId, // No need to store 'id' field if using Firestore's document ID as the source of truth
      username,
      timeRange,
      title,
      description: description || '',
      albums,
      createdAt: FieldValue.serverTimestamp(), // Use Firebase server timestamp
    };

    await newDocRef.set(sharedCollectionData);
    console.log(`Shared collection saved to Firestore with ID: ${uniqueId}`);

    return NextResponse.json({ message: 'Collection shared successfully!', sharedCollectionId: uniqueId }, { status: 201 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Share API: General error: ${errorMessage}`);
    // Check if it's a Firebase specific error for more detailed logging if needed
    if (error && (error as any).code && (error as any).message) {
         console.error(`Firebase Error Code: ${(error as any).code}, Message: ${(error as any).message}`);
    }
    return NextResponse.json({ message: 'Error processing share request', error: errorMessage }, { status: 500 });
  }
}
