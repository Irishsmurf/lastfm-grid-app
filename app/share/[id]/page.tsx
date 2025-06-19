import type { Metadata, ResolvingMetadata } from 'next';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { ImageOff } from 'lucide-react'; // Removed ExternalLink
import type { SharedGridData, MinimizedAlbum } from '@/lib/types';
import { logger } from '@/utils/logger';

const CTX = 'SharePage';

type Props = {
  params: { id: string };
  // searchParams: { [key: string]: string | string[] | undefined }; // Not using searchParams for now
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata // parent can be used to inherit parent metadata
): Promise<Metadata> {
  const id = params.id;
  logger.info('generateMetadata', `Generating metadata for share ID: ${id}`);

  try {
    // Construct the full URL for fetching.
    // IMPORTANT: This needs to be an absolute URL for server-side fetching.
    const response = await fetch(`https://lastfm.paddez.com/api/share/${id}`);

    if (!response.ok) {
      logger.error('generateMetadata', `API error for ID ${id}: ${response.status}`);
      // Consider logging response.text() if the error body is useful
      // const errorBody = await response.text();
      // logger.error('generateMetadata', `Error body for ID ${id}: ${errorBody}`);
      return {
        title: 'Error Generating Grid Preview',
        description: 'Could not load the shared grid data due to a server error.',
      };
    }

    const sharedData: SharedGridData = await response.json();

    if (!sharedData || !sharedData.username) {
      logger.warn('generateMetadata', `No data or username found for ID: ${id}`);
      return {
        title: 'Grid Not Found',
        description: 'The requested shared grid could not be found or is empty.',
        metadataBase: new URL('https://lastfm.paddez.com'),
      };
    }

    const title = `${sharedData.username}'s Last.fm Grid for ${sharedData.period}`;
    let description = `Check out ${sharedData.username}'s top albums for ${sharedData.period}.`;
    if (sharedData.albums && sharedData.albums.length > 0) {
      const artistNames = Array.from(
        new Set(
          sharedData.albums
            .slice(0, 3)
            .map((album) => album.artist.name)
            .filter(Boolean) // Filter out any undefined or null artist names
        )
      ).join(', ');
      if (artistNames) {
        description += ` Featuring artists like ${artistNames}, and more.`;
      }
    }

    const previousImages = (await parent).openGraph?.images || [];
    const ogImageUrl = sharedData.albums?.[0]?.imageUrl
      ? sharedData.albums[0].imageUrl
      : previousImages[0]?.url || '/globe.svg'; // metadataBase handles relative path

    return {
      metadataBase: new URL('https://lastfm.paddez.com'),
      title,
      description,
      openGraph: {
        title,
        description,
        images: [
          {
            url: ogImageUrl, // URL will be absolute due to metadataBase or if already absolute
            width: sharedData.albums?.[0]?.imageUrl ? 300 : 512, // Assuming common square album art, or default for globe
            height: sharedData.albums?.[0]?.imageUrl ? 300 : 512,
            alt: `${sharedData.username}'s top album cover for ${sharedData.period}`,
          },
        ],
        url: `https://lastfm.paddez.com/share/${id}`,
        type: 'website',
        siteName: 'LastFM Album Collage Generator',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImageUrl], // URL will be absolute
      },
    };
  } catch (error) {
    logger.error(
      'generateMetadata',
      `Catch block error for ID ${id}: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      title: 'Error',
      description: 'An unexpected error occurred while generating the grid preview.',
      metadataBase: new URL('https://lastfm.paddez.com'),
    };
  }
}

// The 'use client' directive should be AFTER server-side code like generateMetadata
'use client';

// Removed unused Artist, AlbumImage, and Album interfaces.
// MinimizedAlbum is used directly from SharedGridData.

// Removed unused SpotifyLinks, LogoColorStates, SpotifyCueVisible interfaces from here
// as they are related to client-side logic.

export default function SharedGridPage() {
  // Client-side state definitions
  const [spotifyLinks, setSpotifyLinks] = useState<{[albumKey: string]: string | null}>({});
  const [logoColorStates, setLogoColorStates] = useState<{[albumKey: string]: 'light' | 'dark'}>({});
  const [spotifyCueVisible, setSpotifyCueVisible] = useState<{[albumKey: string]: boolean}>({});

  // Function to determine logo background type based on image brightness
  const getLogoBackgroundColorType = (
    imageUrl: string,
    albumKey: string // Changed from albumId to albumKey for consistency
  ) => {
    const img = document.createElement('img');
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setLogoColorStates((prev) => ({ ...prev, [albumKey]: 'dark' }));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let r = 0,
        g = 0,
        b = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        // Consider only pixels with some opacity
        if (data[i + 3] > 50) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
      }
      if (count === 0) {
        setLogoColorStates((prev) => ({ ...prev, [albumKey]: 'dark' }));
        return;
      }
      r /= count;
      g /= count;
      b /= count;
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      const type = brightness > 128 ? 'light' : 'dark';
      setLogoColorStates((prev) => ({ ...prev, [albumKey]: type }));
    };
    img.onerror = () => {
      // Fallback if image fails to load
      setLogoColorStates((prev) => ({ ...prev, [albumKey]: 'dark' }));
    };
  };

  const params = useParams();
  const id = params.id as string;

  const [sharedData, setSharedData] = useState<SharedGridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [spotifyLinks, setSpotifyLinks] = useState<SpotifyLinks>({});
  const [logoColorStates, setLogoColorStates] = useState<LogoColorStates>({});
  const [spotifyCueVisible, setSpotifyCueVisible] = useState<SpotifyCueVisible>(
    {}
  );
  const [_loadingSpotifyLinks, setLoadingSpotifyLinks] = useState(false);

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
            const errorData = await res
              .json()
              .catch(() => ({ message: 'Failed to parse error response' }));
            logger.error(
              CTX,
              `API error for ID ${id}: ${res.status} - ${errorData?.message || 'Unknown error'}`
            );
            throw new Error(
              errorData.message || `Error fetching shared grid: ${res.status}`
            );
          }
          return res.json();
        })
        .then((data: SharedGridData) => {
          logger.info(
            CTX,
            `Successfully fetched shared data for ID: ${id}, user: ${data.username}`
          );
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
      logger.info(
        CTX,
        `Fetching Spotify links for ${sharedData.albums.length} albums, shared ID: ${id}`
      );
      setLoadingSpotifyLinks(true);
      const newSpotifyLinks: SpotifyLinks = {};
      // newLogoColorStates will be populated by getLogoBackgroundColorType or default
      const newSpotifyCueVisible: SpotifyCueVisible = {};

      // Initialize logoColorStates to 'dark' for all albums initially
      const initialLogoColorStates: LogoColorStates = {};
      sharedData.albums.forEach((album) => {
        initialLogoColorStates[album.mbid] = 'dark';
      });
      setLogoColorStates(initialLogoColorStates);

      const fetchPromises = sharedData.albums.map(async (album) => {
        const albumKey = album.mbid; // Use mbid as the key
        try {
          const response = await fetch(
            `/api/spotify-link?artistName=${encodeURIComponent(
              album.artist.name
            )}&albumName=${encodeURIComponent(album.name)}`
          );
          if (!response.ok) {
            logger.warn(
              CTX,
              `Spotify link API error for ${albumKey}, status: ${response.status}`
            );
            newSpotifyLinks[albumKey] = null;
            // newLogoColorStates[albumKey] = 'black'; // Handled by getLogoBackgroundColorType or default
          } else {
            const data = await response.json();
            newSpotifyLinks[albumKey] = data.spotifyUrl || null;
            // newLogoColorStates[albumKey] = data.spotifyUrl ? 'green' : 'black'; // Handled by getLogoBackgroundColorType
            logger.info(
              CTX,
              `Spotify link for ${albumKey}: ${data.spotifyUrl}`
            );
          }
        } catch (e) {
          logger.error(
            CTX,
            `Error fetching Spotify link for ${albumKey}: ${e instanceof Error ? e.message : String(e)}`
          );
          newSpotifyLinks[albumKey] = null;
          // newLogoColorStates[albumKey] = 'black'; // Handled by getLogoBackgroundColorType or default
        }

        // Set cue visibility based on whether a Spotify URL was found
        newSpotifyCueVisible[albumKey] = !!newSpotifyLinks[albumKey];

        // Trigger logo background color analysis
        if (album.imageUrl) {
          getLogoBackgroundColorType(album.imageUrl, albumKey);
        } else {
          // If no image, explicitly set to dark (though it's the default)
          setLogoColorStates((prev) => ({ ...prev, [albumKey]: 'dark' }));
        }
      });

      Promise.all(fetchPromises)
        .then(() => {
          setSpotifyLinks(newSpotifyLinks);
          // setLogoColorStates is handled by getLogoBackgroundColorType
          setSpotifyCueVisible(newSpotifyCueVisible);
          logger.info(
            CTX,
            'Finished fetching all Spotify links and analyzing images.'
          );
        })
        .catch((e) => {
          logger.error(
            CTX,
            `Error in Promise.all for Spotify links: ${e instanceof Error ? e.message : String(e)}`
          );
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
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <header>
          <p className="text-center text-sm text-muted-foreground mb-8">
            Album Grid by {sharedData.username} - Period: {sharedData.period} |
            Generated on: {formattedDate}
          </p>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {sharedData.albums.map((album: MinimizedAlbum, index) => {
            // const albumKey = `${album.artist}-${album.name}`; // Old key
            const albumKey = album.mbid; // New key
            // const spotifyUrl = spotifyLinks[albumKey]; // No longer needed directly here
            // const logoColor = logoColorStates[albumKey] || 'black'; // Old logic
            // const cueVisible = spotifyCueVisible[albumKey] || false; // Old logic

            return (
              <Card key={index} className="flex flex-col">
                <CardContent className="p-4">
                  <div className="aspect-square relative group album-hover-container">
                    {spotifyCueVisible[albumKey] && (
                      <div className="absolute top-2 right-2 z-10 p-0.5 bg-black/20 rounded-sm flex items-center justify-center">
                        <Image
                          src="/spotify_icon.svg"
                          alt="Spotify Playable Cue"
                          width={24}
                          height={24}
                          className="w-6 h-6 opacity-75"
                        />
                      </div>
                    )}
                    <Image
                      src={album.imageUrl || '/api/placeholder/300/300'}
                      alt={`${album.name} by ${album.artist.name}`}
                      fill
                      sizes="(max-width: 768px) 100vw, 300px"
                      className={`object-cover ${spotifyLinks[albumKey] ? 'group-hover:opacity-70' : ''}`}
                      priority={index < 9} // Prioritize loading for above-the-fold images
                    />
                    {spotifyLinks[albumKey] && (
                      <a
                        href={spotifyLinks[albumKey]!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 spotify-icon-overlay ${logoColorStates[albumKey] === 'light' ? 'spotify-logo-light-bg' : 'spotify-logo-dark-bg'}`}
                      >
                        <Image
                          src="/spotify_icon.svg"
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
                      <a
                        href={`https://musicbrainz.org/release/${album.mbid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {album.name}
                      </a>
                    </p>
                    <p
                      className="text-sm text-muted-foreground truncate"
                      title={album.artist.name}
                    >
                      <a
                        href={`https://musicbrainz.org/artist/${album.artist.mbid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {album.artist.name}
                      </a>
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
