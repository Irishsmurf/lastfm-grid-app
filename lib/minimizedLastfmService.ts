// lib/minimizedLastfmService.ts

import { LastFmTopAlbumsResponse, LastFmAlbum } from './lastfmService'; // Adjust path if necessary

export interface MinimizedAlbumArtist {
  name: string;
  mbid: string;
}

export interface MinimizedAlbum {
  name: string;
  artist: MinimizedAlbumArtist;
  imageUrl: string; // Storing only the large image URL
  mbid: string;
  playcount: number; // Storing as number
}

export function transformLastFmResponse(
  lastFmResponse: LastFmTopAlbumsResponse
): MinimizedAlbum[] {
  if (!lastFmResponse?.topalbums?.album) {
    return [];
  }

  return lastFmResponse.topalbums.album.map(
    (album: LastFmAlbum): MinimizedAlbum => {
      let imageUrl = '';
      // Last.fm provides images in different sizes. image[3] is often 'extralarge'.
      // Check if image array exists and has the desired entry.
      if (album.image && album.image[3] && album.image[3]['#text']) {
        imageUrl = album.image[3]['#text'];
      } else if (album.image && album.image.length > 0) {
        // Fallback to the last available image if the preferred one isn't there
        imageUrl = album.image[album.image.length - 1]['#text'];
      }
      // Further fallback could be a placeholder URL if needed, but for now, empty string if no image.

      return {
        name: album.name,
        artist: {
          name: album.artist.name,
          mbid: album.artist.mbid,
        },
        imageUrl: imageUrl,
        mbid: album.mbid,
        playcount: parseInt(album.playcount, 10) || 0, // Convert to number, default to 0 if parsing fails
      };
    }
  );
}
