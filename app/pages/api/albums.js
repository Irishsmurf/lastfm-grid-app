// pages/api/albums.js
import { redis } from '../../lib/redis';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { username, period } = req.query;
    const cacheKey = `lastfm:${username}:${period}`;

    try {
        // Check cache first
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            return res.status(200).json(JSON.parse(cachedData));
        }

        // If not in cache, fetch from LastFM
        const response = await fetch(
            `${process.env.LASTFM_BASE_URL}?method=user.gettopalbums&user=${username}&period=${period}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=9`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch from LastFM');
        }

        const data = await response.json();

        // Cache the response for 1 hour
        await redis.setex(cacheKey, 3600, JSON.stringify(data));

        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching albums', error: error.message });
    }
}
