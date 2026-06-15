'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Share2, Check } from 'lucide-react';
import type { SharedGridData, MinimizedAlbum } from '@/lib/types';
import { logger } from '@/utils/logger';
import SharePageSkeleton from '@/components/share-page-skeleton';

const CTX = 'SharePage';

interface SpotifyLinks {
  [albumKey: string]: string | null;
}

interface LogoColorStates {
  [albumKey: string]: 'light' | 'dark';
}

interface SpotifyCueVisible {
  [albumKey: string]: boolean;
}

export default function SharePageClient() {
  // Function to determine logo background type based on image brightness
  const getLogoBackgroundColorType = (imageUrl: string, albumKey: string) => {
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
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      })
      .catch((err) => {
        logger.error(
          CTX,
          `Failed to copy share link: ${err instanceof Error ? err.message : String(err)}`
        );
      });
  };

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
      const newSpotifyCueVisible: SpotifyCueVisible = {};

      const initialLogoColorStates: LogoColorStates = {};
      sharedData.albums.forEach((album) => {
        initialLogoColorStates[album.mbid] = 'dark';
      });
      setLogoColorStates(initialLogoColorStates);

      const fetchPromises = sharedData.albums.map(async (album) => {
        const albumKey = album.mbid;
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
          } else {
            const data = await response.json();
            newSpotifyLinks[albumKey] = data.spotifyUrl || null;
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
        }

        newSpotifyCueVisible[albumKey] = !!newSpotifyLinks[albumKey];

        if (album.imageUrl) {
          getLogoBackgroundColorType(album.imageUrl, albumKey);
        } else {
          setLogoColorStates((prev) => ({ ...prev, [albumKey]: 'dark' }));
        }
      });

      Promise.all(fetchPromises)
        .then(() => {
          setSpotifyLinks(newSpotifyLinks);
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
    return <SharePageSkeleton />;
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
    <div className="min-h-screen bg-background pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Hero */}
        <header className="pt-10 pb-0 text-center">
          <div className="flex justify-center mb-5">
            <Image
              src="/logo.svg"
              alt="LastFM Album Collage logo"
              width={72}
              height={72}
              priority
            />
          </div>
          <h1 className="font-montserrat font-black uppercase tracking-tight leading-none text-5xl sm:text-6xl lg:text-[5.5rem]">
            LastFM Album <span className="text-brand-red">Collage</span>
          </h1>
        </header>

        {/* Grid metadata + copy action */}
        <div className="border-y border-border mt-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Album Grid by {sharedData.username} - Period: {sharedData.period}{' '}
              | Generated on: {formattedDate}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              disabled={linkCopied}
              className="gap-2 h-8 text-xs self-start sm:self-auto shrink-0"
            >
              {linkCopied ? (
                <Check className="h-3 w-3 text-brand-success" />
              ) : (
                <Share2 size={13} />
              )}
              {linkCopied ? 'Copied!' : 'Copy link'}
            </Button>
          </div>
        </div>

        {/* Album grid — tight mosaic, no card wrappers */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-6">
          {sharedData.albums.map((album: MinimizedAlbum, index) => {
            const albumKey = album.mbid;

            return (
              <div key={index} className="album-grid-cell flex flex-col">
                <div className="aspect-square relative group album-hover-container overflow-hidden">
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
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className={`object-cover ${spotifyLinks[albumKey] ? 'group-hover:opacity-70' : ''}`}
                    priority={index < 9}
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
                <div className="pt-1.5 pb-1 min-w-0">
                  <p
                    className="text-[11px] font-semibold truncate leading-tight"
                    title={album.name}
                  >
                    <a
                      href={`https://musicbrainz.org/release/${album.mbid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {album.name}
                    </a>
                  </p>
                  <p
                    className="text-[11px] text-muted-foreground truncate leading-tight"
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
