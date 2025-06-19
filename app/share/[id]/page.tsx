'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Music, ImageOff } from 'lucide-react';
import type { SharedGridData, MinimizedAlbum } from '@/lib/types';
import { logger } from '@/utils/logger';

const CTX = 'SharePage';

// Simplified local types for rendering, similar to app/page.tsx
interface Artist {
  name: string;
  url?: string; // Last.fm URL
}

interface AlbumImage {
  '#text': string;
  size: string;
}

interface Album extends MinimizedAlbum {
  // MinimizedAlbum already has name, artist (string), image (string)
  // We might add other properties if needed for rendering based on app/page.tsx
  // For now, MinimizedAlbum structure seems sufficient for basic display.
  // If app/page.tsx uses a more detailed Album type for rendering, we might need to adjust.
}

interface SpotifyLinks {
  [albumKey: string]: string | null;
}

interface LogoColorStates {
  [albumKey: string]: 'black' | 'green';
}

interface SpotifyCueVisible {
  [albumKey: string]: boolean;
}

export default function SharedGridPage() {
  const params = useParams();
  const id = params.id as string;

  const [sharedData, setSharedData] = useState<SharedGridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [spotifyLinks, setSpotifyLinks] = useState<SpotifyLinks>({});
  const [logoColorStates, setLogoColorStates] = useState<LogoColorStates>({});
  const [spotifyCueVisible, setSpotifyCueVisible] = useState<SpotifyCueVisible>({});
  const [loadingSpotifyLinks, setLoadingSpotifyLinks] = useState(false);


  useEffect(() => {
    if (id) {
      logger.info(CTX, `Fetching shared grid data for ID: ${id}`);
      setLoading(true);
      setError(null);
      fetch(`/api/share/${id}`)
        .then(async (res) => {
          if (!res.ok) {
            if (res.status === 404) {
              logger.warn(CTX, `Shared grid not found for ID: ${id}`);
              throw new Error('Shared grid not found');
            }
            const errorData = await res.json().catch(() => ({ message: 'Failed to parse error response' }));
            logger.error(CTX, `API error for ID ${id}: ${res.status} - ${errorData?.message || 'Unknown error'}`);
            throw new Error(errorData.message || `Error fetching shared grid: ${res.status}`);
          }
          return res.json();
        })
        .then((data: SharedGridData) => {
          logger.info(CTX, `Successfully fetched shared data for ID: ${id}, user: ${data.username}`);
          setSharedData(data);
        })
        .catch((err) => {
          logger.error(CTX, `Catch block error for ID ${id}: ${err.message}`);
          setError(err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id]);

  useEffect(() => {
    if (sharedData?.albums && sharedData.albums.length > 0) {
      logger.info(CTX, `Fetching Spotify links for ${sharedData.albums.length} albums, shared ID: ${id}`);
      setLoadingSpotifyLinks(true);
      const newSpotifyLinks: SpotifyLinks = {};
      const newLogoColorStates: LogoColorStates = {};
      const newSpotifyCueVisible: SpotifyCueVisible = {};

      const fetchPromises = sharedData.albums.map(async (album) => {
        const albumKey = `${album.artist}-${album.name}`;
        try {
          const response = await fetch(
            `/api/spotify-link?artistName=${encodeURIComponent(
              album.artist
            )}&albumName=${encodeURIComponent(album.name)}`
          );
          if (!response.ok) {
            logger.warn(CTX, `Spotify link API error for ${albumKey}, status: ${response.status}`);
            newSpotifyLinks[albumKey] = null;
            newLogoColorStates[albumKey] = 'black';
            return;
          }
          const data = await response.json();
          newSpotifyLinks[albumKey] = data.spotifyUrl || null;
          newLogoColorStates[albumKey] = data.spotifyUrl ? 'green' : 'black';
          logger.debug(CTX, `Spotify link for ${albumKey}: ${data.spotifyUrl}`);
        } catch (e) {
          logger.error(CTX, `Error fetching Spotify link for ${albumKey}: ${e instanceof Error ? e.message : String(e)}`);
          newSpotifyLinks[albumKey] = null;
          newLogoColorStates[albumKey] = 'black';
        }
        newSpotifyCueVisible[albumKey] = false; // Default to hidden
      });

      Promise.all(fetchPromises)
        .then(() => {
          setSpotifyLinks(newSpotifyLinks);
          setLogoColorStates(newLogoColorStates);
          setSpotifyCueVisible(newSpotifyCueVisible);
          logger.info(CTX, "Finished fetching all Spotify links.");
        })
        .catch((e) => {
            logger.error(CTX, `Error in Promise.all for Spotify links: ${e instanceof Error ? e.message : String(e)}`);
        })
        .finally(() => {
          setLoadingSpotifyLinks(false);
        });
    }
  }, [sharedData, id]);


  if (loading) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-lg">Loading shared grid...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-lg text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (!sharedData) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-lg">No shared grid data found.</p>
      </div>
    );
  }

  const formattedDate = new Date(sharedData.createdAt).toLocaleDateString(
    undefined,
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  );

  return (
    <div className="container mx-auto p-4">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold">
          Album Grid by {sharedData.username}
        </h1>
        <p className="text-md text-muted-foreground">
          Period: {sharedData.period} | Generated on: {formattedDate}
        </p>
      </header>
      <hr className="my-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {sharedData.albums.map((album, index) => {
          const albumKey = `${album.artist}-${album.name}`;
          const spotifyUrl = spotifyLinks[albumKey];
          const logoColor = logoColorStates[albumKey] || 'black';
          const cueVisible = spotifyCueVisible[albumKey] || false;

          return (
            <Card
              key={index}
              className="flex flex-col"
              onMouseEnter={() =>
                setSpotifyCueVisible((prev) => ({ ...prev, [albumKey]: true }))
              }
              onMouseLeave={() =>
                setSpotifyCueVisible((prev) => ({ ...prev, [albumKey]: false }))
              }
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg truncate" title={album.name}>
                  {album.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground truncate" title={album.artist}>
                  {album.artist}
                </p>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col items-center justify-center relative">
                {album.image ? (
                  <Image
                    src={album.image}
                    alt={`${album.name} by ${album.artist}`}
                    width={200}
                    height={200}
                    className="object-cover rounded-md"
                    priority={index < 9} // Prioritize loading for above-the-fold images
                  />
                ) : (
                  <div className="w-[200px] h-[200px] bg-secondary rounded-md flex flex-col items-center justify-center text-muted-foreground">
                    <ImageOff size={48} />
                    <span className="mt-2 text-sm">No image available</span>
                  </div>
                )}
                {cueVisible && spotifyUrl && (
                  <div className="absolute bottom-2 right-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(spotifyUrl, '_blank')}
                      title="Listen on Spotify"
                      className="bg-white hover:bg-gray-100"
                    >
                      <Music
                        size={20}
                        color={logoColor}
                        className="transition-colors duration-300"
                      />
                    </Button>
                  </div>
                )}
                 {cueVisible && !spotifyUrl && !loadingSpotifyLinks && (
                    <div className="absolute bottom-2 right-2" title="Not found on Spotify">
                         <Button
                            variant="outline"
                            size="icon"
                            disabled
                            className="bg-white"
                        >
                            <Music size={20} color="grey" />
                        </Button>
                    </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
       <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          Powered by Last.fm and Spotify. Grid shared via Album Grid Generator.
        </p>
      </footer>
    </div>
  );
}
