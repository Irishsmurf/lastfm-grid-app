// Assuming fetch is globally available (e.g., in Next.js environment)
// If not, you might need to import it: import fetch from 'node-fetch';
import { logger } from '@/utils/logger';

const CTX = 'LastFMService';

// const LASTFM_API_KEY = process.env.LASTFM_API_KEY; // Will read directly in function
// const LASTFM_BASE_URL =
// process.env.LASTFM_BASE_URL || 'https://ws.audioscrobbler.com/2.0/'; // Will read directly in function

// Removed top-level API key check. It will be checked within functions using it.

export interface LastFmAlbum {
  artist: {
    name: string;
    mbid: string;
    url: string;
  };
  image: Array<{
    '#text': string;
    size: string;
  }>;
  mbid: string;
  name: string;
  playcount: string;
  url: string;
}

interface LastFmError {
  error: number;
  message: string;
}

export interface LastFmTopAlbumsResponse {
  topalbums?: {
    album: LastFmAlbum[];
    '@attr': {
      user: string;
      totalPages: string;
      page: string;
      perPage: string;
      total: string;
    };
  };
}

type LastFmResponse = LastFmTopAlbumsResponse | LastFmError;

/**
 * Fetches the top albums for a given user from the Last.fm API.
 *
 * @param {string} username The Last.fm username.
 * @param {string} period The time period over which to retrieve top albums.
 *                        Valid periods: overall, 7day, 1month, 3month, 6month, 12month.
 * @param {number} [limit=9] The number of albums to retrieve. Defaults to 9.
 * @returns {Promise<LastFmTopAlbumsResponse>} A promise that resolves to the API response
 *                                            containing the user's top albums.
 *                                            Returns a default empty structure if albums are not found
 *                                            or in case of certain API errors that are handled gracefully.
 * @throws {Error} If the API key is not configured, or if there's an unrecoverable
 *                 API error or network issue.
 */
export async function getTopAlbums(
  username: string,
  period: string,
  limit: number = 9
): Promise<LastFmTopAlbumsResponse> {
  const apiKey = process.env.LASTFM_API_KEY;
  const baseUrl =
    process.env.LASTFM_BASE_URL || 'https://ws.audioscrobbler.com/2.0/';

  if (!apiKey) {
    logger.error(
      CTX,
      'Last.fm API key not configured in environment variables (LASTFM_API_KEY)'
    );
    throw new Error(
      'Last.fm API key not configured in environment variables (LASTFM_API_KEY)'
    );
  }

  const params = new URLSearchParams({
    method: 'user.gettopalbums',
    user: username,
    period: period,
    api_key: apiKey,
    format: 'json',
    limit: limit.toString(),
  });

  const apiUrl = `${baseUrl}?${params.toString()}`;
  const urlForLogging = new URL(apiUrl);
  urlForLogging.searchParams.delete('api_key');
  logger.info(CTX, `Fetching Last.fm API: ${urlForLogging.toString()}`);

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        CTX,
        `Last.fm API Error: ${response.status} ${response.statusText} - ${errorText}`
      );
      throw new Error(
        `Failed to fetch top albums from Last.fm: ${response.statusText}`
      );
    }

    const data: LastFmResponse = await response.json();

    // Last.fm API returns a 200 OK even for API errors, so check the body
    if ('error' in data) {
      logger.error(
        CTX,
        `Last.fm API Error (in response body): ${data.error} - ${data.message}`
      );
      throw new Error(`Last.fm API error: ${data.message}`);
    }

    // Ensure the response structure is as expected before returning
    if (!data.topalbums || !data.topalbums.album) {
      const receivedKeys = data
        ? Object.keys(data).join(', ')
        : 'null or undefined';
      logger.warn(
        CTX,
        `Last.fm response is missing 'topalbums.album' structure. Received object keys: ${receivedKeys}`
      );
      // Return a structure that matches success but with empty albums,
      // or handle as an error depending on desired strictness.
      return {
        topalbums: {
          album: [],
          '@attr': {
            user: username,
            totalPages: '0',
            page: '1',
            perPage: limit.toString(),
            total: '0',
          },
        },
      };
    }

    logger.info(
      CTX,
      `Successfully fetched ${data.topalbums.album.length} albums from Last.fm for user ${username}`
    );
    return data as LastFmTopAlbumsResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error;
    logger.error(
      CTX,
      `Error fetching or processing Last.fm data: ${errorMessage}`
    );
    if (error instanceof Error) {
      throw error; // Re-throw known errors
    }
    throw new Error(
      'An unexpected error occurred while fetching top albums from Last.fm.'
    );
  }
}
