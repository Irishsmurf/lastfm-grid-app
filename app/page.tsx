// app/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from 'lucide-react';
import { ThemeToggleButton } from '@/components/theme-toggle-button';
import CreateShareForm from '../components/create-share-form'; // Import the new form component

const timeRanges = {
  '7day': "Last Week",
  '1month': 'Last Month',
  '3month': 'Last 3 Months',
  '6month': 'Last 6 Months',
  '12month': 'Last Year',
  'overall': 'Overall'
};

interface AlbumImage {
  'size': string;
  '#text': string;
}

interface Album {
  name: string;
  artist: Artist;
  image: Array<AlbumImage>;
  mbid: string; // Assuming mbid is consistently available and unique
  playcount: number;
  // spotifyUrl is removed from here, will be managed by spotifyLinks state
}

interface Artist {
  name: string;
  url: string;
  mbid: string;
}

export default function Home() {
  const [username, setUsername] = useState('');
  const [timeRange, setTimeRange] = useState('1month');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // const [imageLoadingStates, setImageLoadingStates] = useState<{ [key: number]: boolean }>({}); // Unused
  const [spotifyLinks, setSpotifyLinks] = useState<Record<string, string | null>>({});

  // Load username from localStorage on component mount
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  const fetchTopAlbums = async () => {
    if (!username) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/albums?username=${encodeURIComponent(username)}&period=${timeRange}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch albums');
      }

      const data = await response.json();
      const albumData = data.topalbums.album.slice(0, 9).map((album: Album) => ({ // Ensure Album type here doesn't expect spotifyUrl
        name: album.name,
        artist: album.artist,
        image: album.image,
        mbid: album.mbid,
        playcount: album.playcount,
      }));

      setAlbums(albumData);
      // Save username to localStorage after successful fetch
      localStorage.setItem('username', username);
    } catch (err) {
      console.error('An error occurred: ', err);
      setError('Error fetching albums. Please check the username and try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateImage = async () => {
    if (!canvasRef.current || albums.length !== 9) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 900;
    canvas.height = 900;

    // Clear canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Modified loadImage function
    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        if (!url) {
          // Handle empty URL case
          reject(new Error('No image URL provided'));
          return;
        }

        const img = document.createElement('img');
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => {
          // Create a fallback for failed images
          const fallbackImg = document.createElement('img');
          fallbackImg.src = '/api/placeholder/300/300';
          fallbackImg.onload = () => resolve(fallbackImg);
          fallbackImg.onerror = () => reject(new Error('Failed to load placeholder image'));
        };
        img.src = url;
      });
    };

    try {
      // Create 3x3 grid
      for (let i = 0; i < 9; i++) {
        const x = (i % 3) * 300;
        const y = Math.floor(i / 3) * 300;
        
        try {
          const img = await loadImage(albums[i].image[3]['#text']);
          ctx.drawImage(img, x, y, 300, 300);
        } catch (error) {
          console.log('Image failed to load: ', error)
          // If image fails to load, draw a placeholder rectangle
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(x, y, 300, 300);
          ctx.fillStyle = '#666666';
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Image not available', x + 150, y + 150);
        }
      }

      // Add watermark
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
      ctx.fillStyle = '#000000';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${username}'s Top Albums - ${timeRanges[timeRange as keyof typeof timeRanges]}`, canvas.width / 2, canvas.height - 10);

      // Trigger download
      const link = document.createElement('a');
      link.download = `${username}-${timeRange}-albums.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.8);
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
      setError('Error generating image. Please try again.');
    }
  };

  // Unused function and effect related to imageLoadingStates
  // const handleImageLoad = (index: number) => {
  //   setImageLoadingStates(prev => ({ ...prev, [index]: true }));
  // };

  // useEffect(() => {
  //   setImageLoadingStates({});
  // }, [albums]);

  // useEffect to fetch Spotify links when albums change
  useEffect(() => {
    if (albums.length === 0) {
      setSpotifyLinks({}); // Clear links if no albums
      return;
    }

    setSpotifyLinks({}); // Reset links before fetching for new set of albums

    albums.forEach(album => {
      if (!album.mbid) { // Ensure we have a key
        console.warn('Album missing mbid, cannot fetch Spotify link:', album.name);
        return;
      }

      const fetchSpotifyLink = async () => {
        try {
          const response = await fetch(
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
            setSpotifyLinks(prevLinks => ({
              ...prevLinks,
              [album.mbid]: null,
            }));
          }
        } catch (err) {
          console.error(`Error fetching Spotify link for ${album.name}:`, err);
          setSpotifyLinks(prevLinks => ({
            ...prevLinks,
            [album.mbid]: null,
          }));
        }
      };

      fetchSpotifyLink();
    });
  }, [albums]); // Dependency: albums array itself, not its content for this trigger

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <Input
                type="text"
                placeholder="LastFM Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1"
              />
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(timeRanges).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={fetchTopAlbums}
                disabled={loading}
                className="w-full md:w-auto"
              >
                {loading ? 'Loading...' : 'Generate Grid'}
              </Button>
              <ThemeToggleButton />
            </div>
            {error && <p className="text-red-500 dark:text-red-400 mt-2">{error}</p>}
          </CardContent>
        </Card>

        {albums.length > 0 && (
          <>
            <div className="flex justify-end mb-4">
              <Button onClick={generateImage} className="gap-2">
                <Download size={16} />
                Download Grid
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {albums.map((album, index) => {
                const currentSpotifyUrl = album.mbid ? spotifyLinks[album.mbid] : null;
                return (
                  <Card key={album.mbid || index}> {/* Use mbid as key if available */}
                    <CardContent className="p-4">
                      <div className="aspect-square relative group album-hover-container">
                        <Image
                          src={album.image[3]?.['#text'] || '/api/placeholder/300/300'}
                          alt={`${album.name} by ${album.artist.name}`}
                          fill
                          className={`object-cover ${currentSpotifyUrl ? 'group-hover:opacity-70' : ''}`}
                          sizes="(max-width: 768px) 100vw, 300px"
                          // onLoad={() => handleImageLoad(index)} // Removed as imageLoadingStates is unused
                        />
                        {currentSpotifyUrl && (
                          <a
                            href={currentSpotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 spotify-icon-overlay"
                          >
                            <Image
                              src="/spotify_icon.svg"
                              alt="Play on Spotify"
                              width={64} // Adjust size as needed
                              height={64} // Adjust size as needed
                              className="w-16 h-16" // Tailwind class for size
                            />
                          </a>
                        )}
                      </div>
                      <div className="mt-2">
                      <p className="font-semibold truncate">
                          <a href={`https://musicbrainz.org/release/${album.mbid}`} target="_blank" rel="noopener noreferrer">{album.name}</a>
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                          <a href={`https://musicbrainz.org/artist/${album.artist.mbid}`} target="_blank" rel="noopener noreferrer">{album.artist.name}</a>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ); // Explicit semicolon
            })}
            </div>
          </>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* New Section for Sharing */}
      <div className="max-w-4xl mx-auto mt-12">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-2xl font-semibold mb-4 text-center">Share Your Music Taste</h2>
            <CreateShareForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}