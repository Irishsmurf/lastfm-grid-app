// app/share/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation'; // For accessing dynamic route parameters
import Image from 'next/image';
import Link from 'next/link'; // For linking to MusicBrainz or similar
import { Card, CardContent } from '@/components/ui/card'; // Assuming these are used
import type { SharedGridData, MinimizedAlbum } from '@/lib/types'; // Shared types
import { logger } from '@/utils/logger'; // Assuming logger

const CTX = 'SharePage';

// Helper to format date
const formatDate = (isoString: string) => {
  if (!isoString) return 'Unknown Date';
  try {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (e) {
    logger.error(CTX, 'Error formatting date:', e);
    return 'Invalid Date';
  }
};

// Simplified time range mapping for display
const timeRangesDisplay: { [key: string]: string } = {
  '7day': 'Last 7 Days',
  '1month': 'Last Month',
  '3month': 'Last 3 Months',
  '6month': 'Last 6 Months',
  '12month': 'Last Year',
  overall: 'All Time',
};


export default function SharePage() {
  const params = useParams();
  const id = params?.id as string | undefined; // id can be string or string[]

  const [gridData, setGridData] = useState<SharedGridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spotifyLinks, setSpotifyLinks] = useState<Record<string, string | null>>({});
  // Optional: Add states for image loading, logo color, cue visibility if replicating full main page experience

  useEffect(() => {
    if (id) {
      logger.info(CTX, `Fetching shared grid data for ID: ${id}`);
      const fetchGridData = async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/share/${id}`);
          if (response.ok) {
            const data: SharedGridData = await response.json();
            setGridData(data);
            logger.info(CTX, `Successfully fetched grid data for ID: ${id}`, data);
          } else if (response.status === 404) {
            setError('Shared grid not found.');
            logger.warn(CTX, `Grid not found for ID: ${id}`);
          } else {
            const errorData = await response.json();
            setError(errorData.message || 'Failed to load shared grid.');
            logger.error(CTX, `Error fetching grid data for ID: ${id}, Status: ${response.status}`, errorData);
          }
        } catch (err) {
          logger.error(CTX, `Network or unexpected error fetching grid data for ID: ${id}`, err);
          setError('An error occurred while trying to fetch the shared grid.');
        } finally {
          setLoading(false);
        }
      };
      fetchGridData();
    } else {
      // Handle case where ID might not be available initially or is undefined
      setError('No Share ID provided in URL.');
      setLoading(false);
      logger.warn(CTX, 'Share ID is undefined.');
    }
  }, [id]);

  useEffect(() => {
    if (gridData && gridData.albums.length > 0) {
      logger.info(CTX, `Fetching Spotify links for ${gridData.albums.length} albums.`);
      const newSpotifyLinks: Record<string, string | null> = {};
      let linksFetched = 0;

      gridData.albums.forEach(async (album) => {
        if (!album.mbid) { // Use mbid as key
          logger.warn(CTX, `Album "${album.name}" missing mbid, cannot fetch Spotify link.`);
          newSpotifyLinks[album.name] = null; // Fallback key if no mbid
          linksFetched++;
          if (linksFetched === gridData.albums.length) {
            setSpotifyLinks(newSpotifyLinks);
          }
          return;
        }
        try {
          const response = await fetch(
            `/api/spotify-link?albumName=${encodeURIComponent(album.name)}&artistName=${encodeURIComponent(album.artist.name)}`
          );
          if (response.ok) {
            const data = await response.json();
            newSpotifyLinks[album.mbid] = data.spotifyUrl || null;
          } else {
            logger.error(CTX, `Failed to fetch Spotify link for ${album.name}: ${response.status}`);
            newSpotifyLinks[album.mbid] = null;
          }
        } catch (err) {
          logger.error(CTX, `Error fetching Spotify link for ${album.name}:`, err);
          newSpotifyLinks[album.mbid] = null;
        } finally {
          linksFetched++;
          if (linksFetched === gridData.albums.length) {
            setSpotifyLinks(newSpotifyLinks);
            logger.info(CTX, 'Finished fetching all Spotify links.', newSpotifyLinks);
          }
        }
      });
    }
  }, [gridData]);


  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading shared grid...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">Error: {error}</div>;
  }

  if (!gridData) {
    return <div className="min-h-screen flex items-center justify-center">No grid data found.</div>;
  }

  const displayPeriod = timeRangesDisplay[gridData.period] || gridData.period;

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-8">
          <CardContent className="pt-6 text-center">
            <h1 className="text-2xl font-bold mb-2">Album Grid Share</h1>
            <p className="text-muted-foreground">
              Generated by: <span className="font-semibold">{gridData.username}</span>
            </p>
            <p className="text-muted-foreground">
              For period: <span className="font-semibold">{displayPeriod}</span>
            </p>
            <p className="text-muted-foreground">
              Shared on: <span className="font-semibold">{formatDate(gridData.createdAt)}</span>
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-4">
          {gridData.albums.map((album, index) => {
            const currentSpotifyUrl = album.mbid ? spotifyLinks[album.mbid] : spotifyLinks[album.name]; // Fallback to name if no mbid
            return (
              <Card key={album.mbid || index}>
                <CardContent className="p-4">
                  <div className="aspect-square relative group">
                    <Image
                      src={album.imageUrl || '/api/placeholder/300/300'} // Fallback placeholder
                      alt={`${album.name} by ${album.artist.name}`}
                      fill
                      className={`object-cover ${currentSpotifyUrl ? 'group-hover:opacity-70' : ''}`}
                      sizes="(max-width: 768px) 100vw, 300px"
                      // Add onLoad, onError if needed for more complex loading state
                    />
                    {currentSpotifyUrl && (
                      <a
                        href={currentSpotifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        // Add Spotify icon styling if needed (e.g., spotify-icon-overlay from main page)
                      >
                        <Image
                          src="/spotify_icon.svg" // Ensure this path is correct
                          alt="Play on Spotify"
                          width={64}
                          height={64}
                          className="w-16 h-16"
                        />
                      </a>
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="font-semibold truncate" title={album.name}>
                      {album.mbid ? (
                        <Link href={`https://musicbrainz.org/release/${album.mbid}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {album.name}
                        </Link>
                      ) : (
                        album.name
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground truncate" title={album.artist.name}>
                      {album.artist.mbid ? (
                        <Link href={`https://musicbrainz.org/artist/${album.artist.mbid}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {album.artist.name}
                        </Link>
                      ) : (
                        album.artist.name
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
