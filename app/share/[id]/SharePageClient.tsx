'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Share2, Check } from 'lucide-react';
import type { SharedGridData, MinimizedAlbum } from '@/lib/types';

interface SpotifyLinks {
  [albumKey: string]: string | null;
}

interface SharePageClientProps {
  /**
   * Resolved server-side. The page component already reads this record to build
   * its metadata, so re-fetching it from the browser cost an extra Redis read, an
   * HTTP round trip, and a skeleton flash before the grid could appear.
   */
  sharedData: SharedGridData;
  /** Spotify links resolved server-side, keyed by album mbid. */
  spotifyLinks: SpotifyLinks;
}

export default function SharePageClient({
  sharedData,
  spotifyLinks,
}: SharePageClientProps) {
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy share link', err);
      });
  };

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
            const spotifyUrl = spotifyLinks[album.mbid] ?? null;

            return (
              <div key={index} className="album-grid-cell flex flex-col">
                <div className="aspect-square relative group album-hover-container overflow-hidden">
                  {spotifyUrl && (
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
                    src={album.imageUrl || '/placeholder-album.svg'}
                    alt={`${album.name} by ${album.artist.name}`}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className={`object-cover ${spotifyUrl ? 'group-hover:opacity-70' : ''}`}
                    // Only the first tile is a plausible LCP candidate. Marking all
                    // nine as priority made them compete with each other and with
                    // the logo for early bandwidth.
                    priority={index === 0}
                  />
                  {spotifyUrl && (
                    <a
                      href={spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
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
                  <p className="text-[11px] font-semibold truncate leading-tight">
                    <a
                      href={`https://musicbrainz.org/release/${album.mbid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {album.name}
                    </a>
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate leading-tight">
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
