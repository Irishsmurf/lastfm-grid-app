// app/share/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation'; // To get ID from URL
import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggleButton } from '@/components/theme-toggle-button';
// Remove direct Firebase client imports if no longer needed on this page
// import { doc, getDoc, Timestamp } from 'firebase/firestore';
// import { db } from '../../../../lib/firebase';

// Re-using types from app/page.tsx for consistency (Interfaces AlbumImage, Album, Artist remain the same)
interface AlbumImage {
  'size': string;
  '#text': string;
}

interface Album {
  name: string;
  artist: Artist;
  image: Array<AlbumImage>;
  mbid: string;
  playcount: number; // Or string, check Last.fm API consistency
}

interface Artist {
  name: string;
  url: string; // This might be Last.fm URL, not MusicBrainz
  mbid: string;
}

interface SharedCollectionData {
  // id: string; // Not stored in document, ID is from doc.id
  username: string;
  timeRange: string;
  title: string;
  description?: string;
  albums: Album[];
  createdAt: string; // Expecting ISO string from the new API
}

const timeRanges: Record<string, string> = {
  '7day': "Last Week",
  '1month': 'Last Month',
  '3month': 'Last 3 Months',
  '6month': 'Last 6 Months',
  '12month': 'Last Year',
  'overall': 'Overall'
};

export default function SharedCollectionPage() {
  const params = useParams();
  const id = params?.id as string; // Get the 'id' from the URL

  const [collection, setCollection] = useState<SharedCollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [spotifyLinks, setSpotifyLinks] = useState<Record<string, string | null>>({});
  const [fadeInStates, setFadeInStates] = useState<{ [key: number]: boolean }>({});


  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("No collection ID provided.");
      return;
    }

    const fetchCollectionData = async () => {
      setLoading(true);
      setError('');
      try {
        console.log(`Fetching shared collection with ID: ${id} via API`);
        // Fetch from the new API endpoint
        const response = await fetch(`/api/shared-collection/${id}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "Failed to parse error response" }));
          throw new Error(errorData.message || `Failed to fetch collection: ${response.statusText}`);
        }

        const data: SharedCollectionData = await response.json();
        setCollection(data);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
        console.error('Error fetching shared collection via API:', err);
        setError(`Failed to load shared collection. ${errorMessage}`);
        setCollection(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCollectionData();
  }, [id]);

  // Effect for album image fade-in (similar to app/page.tsx)
  useEffect(() => {
    if (collection && collection.albums.length > 0) {
      const initialFadeInStates = collection.albums.reduce((acc, _, index) => {
        acc[index] = false;
        return acc;
      }, {} as { [key: number]: boolean });
      setFadeInStates(initialFadeInStates);

      setTimeout(() => {
        const activeFadeInStates = collection.albums.reduce((acc, _, index) => {
          acc[index] = true;
          return acc;
        }, {} as { [key: number]: boolean });
        setFadeInStates(activeFadeInStates);
      }, 20);
    } else {
      setFadeInStates({});
    }
  }, [collection]);

  // Effect for fetching Spotify links (similar to app/page.tsx)
  useEffect(() => {
    if (!collection || collection.albums.length === 0) {
      setSpotifyLinks({});
      return;
    }

    setSpotifyLinks({}); // Reset before fetching

    collection.albums.forEach(album => {
      if (!album.mbid) {
        console.warn('Album missing mbid, cannot fetch Spotify link:', album.name);
        return;
      }

      const fetchSpotifyLink = async () => {
        try {
          const response = await fetch(
            // Adjust API path if necessary, assuming it's globally available
            `/api/spotify-link?albumName=${encodeURIComponent(album.name)}&artistName=${encodeURIComponent(album.artist.name)}`
          );
          if (response.ok) {
            const data = await response.json();
            setSpotifyLinks(prevLinks => ({
              ...prevLinks,
              [album.mbid]: data.spotifyUrl || null,
            }));
          } else {
            console.error(`Failed to fetch Spotify link for ${album.name}: ${response.status}`);
            setSpotifyLinks(prevLinks => ({ ...prevLinks, [album.mbid]: null }));
          }
        } catch (err) {
          console.error(`Error fetching Spotify link for ${album.name}:`, err);
          setSpotifyLinks(prevLinks => ({ ...prevLinks, [album.mbid]: null }));
        }
      };
      fetchSpotifyLink();
    });
  }, [collection]);


  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p>Loading collection...</p></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-red-500">{error}</p></div>;
  if (!collection) return <div className="min-h-screen flex items-center justify-center bg-background"><p>No collection data found for this ID.</p></div>;

  const collectionTimeRangeLabel = timeRanges[collection.timeRange] || collection.timeRange;
  // `collection.createdAt` is now expected to be an ISO string from the API
  const displayDate = collection.createdAt ? new Date(collection.createdAt).toLocaleDateString() : 'N/A';


  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-end mb-4"> <ThemeToggleButton /> </div>
        <Card className="mb-8">
          <CardContent className="pt-6">
            <h1 className="text-3xl font-bold mb-2">{collection.title}</h1>
            <p className="text-muted-foreground mb-1">Shared by: <span className="font-semibold">{collection.username}</span></p>
            <p className="text-muted-foreground mb-1">Time Frame: <span className="font-semibold">{collectionTimeRangeLabel}</span></p>
            <p className="text-xs text-muted-foreground">Shared on: {displayDate}</p> {/* Display formatted date */}
            {collection.description && ( <p className="mt-3 text-lg">{collection.description}</p> )}
          </CardContent>
        </Card>
        {collection.albums.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {collection.albums.map((album, index) => {
              const currentSpotifyUrl = album.mbid ? spotifyLinks[album.mbid] : null;
              const imageUrl = album.image.find(img => img.size === 'extralarge')?.['#text'] ||
                               album.image.find(img => img.size === 'large')?.['#text'] ||
                               album.image[0]?.['#text'] ||
                               '/api/placeholder/300/300';
              return (
                <Card key={album.mbid || index}>
                  <CardContent className="p-4">
                    <div className="aspect-square relative group album-hover-container">
                      <Image
                        src={imageUrl}
                        alt={`${album.name} by ${album.artist.name}`}
                        fill
                        className={`object-cover ${currentSpotifyUrl ? 'group-hover:opacity-70' : ''} ${fadeInStates[index] ? 'image-fade-enter-active' : 'image-fade-enter'}`}
                        sizes="(max-width: 768px) 100vw, 300px"
                      />
                      {currentSpotifyUrl && (
                        <a
                          href={currentSpotifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 spotify-icon-overlay"
                        >
                          <Image src="/spotify_icon.svg" alt="Play on Spotify" width={64} height={64} className="w-16 h-16" />
                        </a>
                      )}
                    </div>
                    <div className="mt-2">
                      <p className="font-semibold truncate">{album.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{album.artist.name}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
