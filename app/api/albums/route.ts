// app/api/albums/route.js

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '../../../lib/redis';
import { cache } from 'react';


export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');
    const period = searchParams.get('period');

    const cacheKey = `lastfm:${username}:${period}`;

    try {
        // Check cache first
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            console.log(`Returning cached data for ${cacheKey}`)
            return NextResponse.json(JSON.parse(cachedData), { status: 200 });
        }

        // If not in cache, fetch from LastFM
        const response = await fetch(
            `${process.env.LASTFM_BASE_URL}?method=user.gettopalbums&user=${username}&period=${period}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=9`
        );

        if (!response.ok) {
            console.error(response)
            throw new Error('Failed to fetch from LastFM');
        }

        const data = await response.json();

        // Cache the response for 1 hour
        await redis.setex(cacheKey, 3600, JSON.stringify(data));

        return NextResponse.json(data, { status: 200 });
    } catch (error) {
        console.error(error)
        return NextResponse.json({ message: 'Error fetching albums', error: error }, { status: 500 });
    }
}