'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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
  /** Human-readable period label (e.g. "Last 3 Months"), resolved server-side. */
  periodLabel: string;
}

export default function SharePageClient({
  sharedData,
  spotifyLinks,
  periodLabel,
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
      <div className="max-w-4xl mx-auto pt-10">
        <span className="inline-flex items-center text-[11px] tracking-wide px-2.5 py-1 border border-primary text-primary mb-4">
          Shared grid
        </span>

        {/* Heading + metadata */}
        <div className="flex items-baseline justify-between flex-wrap gap-2.5 mb-5">
          <h1 className="text-3xl sm:text-4xl">
            <span className="text-brand-red">{sharedData.username}</span>
            {"'s grid"}
          </h1>
          <span className="text-sm text-muted-foreground">
            {periodLabel} · {sharedData.albums.length} albums · Generated{' '}
            {formattedDate}
          </span>
        </div>
        <hr className="hr" />

        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            disabled={linkCopied}
            className="gap-2 h-8 text-xs"
          >
            {linkCopied ? (
              <Check className="h-3 w-3 text-brand-success" />
            ) : (
              <Share2 size={13} />
            )}
            {linkCopied ? 'Copied!' : 'Copy link'}
          </Button>
        </div>

        {/* Album grid — tight mosaic, thin divider rules between tiles */}
        <div
          className="grid grid-cols-2 sm:grid-cols-3 gap-0.5"
          style={{ backgroundColor: 'var(--color-divider)' }}
        >
          {sharedData.albums.map((album: MinimizedAlbum, index) => {
            const spotifyUrl = spotifyLinks[album.mbid] ?? null;

            return (
              <div
                key={index}
                className="album-grid-cell flex flex-col bg-background"
              >
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
                    // nine as priority made them compete with each other for
                    // early bandwidth.
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
                  <p className="text-[10px] text-muted-foreground/60 leading-tight">
                    {album.playcount.toLocaleString()} plays
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-9">
          <Button asChild>
            <Link href="/">Make Your Own Grid</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
