// app/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Music, ListMusic, ExternalLink, AlertTriangle, CheckCircle } from 'lucide-react';
import { ThemeToggleButton } from '@/components/theme-toggle-button';

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
  mbid: string;
  playcount: number;
}

interface Artist {
  name: string;
  url: string; // Last.fm profile URL for the artist
  mbid: string; // MusicBrainz ID for the artist
}

export default function Home() {
  const [username, setUsername] = useState('');
  const [timeRange, setTimeRange] = useState('1month');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false); // For Last.fm album fetching
  const [error, setError] = useState(''); // For Last.fm album fetching errors
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // const [imageLoadingStates, setImageLoadingStates] = useState<{ [key: number]: boolean }>({}); // Removed as unused
  const [fadeInStates, setFadeInStates] = useState<{ [key: number]: boolean }>({});
  const [spotifyLinks, setSpotifyLinks] = useState<Record<string, string | null>>({});

  // New state for playlist generation
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistMessage, setPlaylistMessage] = useState(''); // For success/error/info messages related to playlist flow

  // Memoize handleCreatePlaylist to stabilize its reference for useEffect
  const handleCreatePlaylist = useCallback(async () => {
    if (albums.length === 0) {
      setPlaylistMessage('No albums loaded to create a playlist from.');
      return;
    }
    setPlaylistLoading(true);
    setPlaylistUrl('');
    setPlaylistMessage('Creating your Spotify playlist...');

    const albumDataForPlaylist = albums.map(album => ({
      albumName: album.name,
      artistName: album.artist.name,
    }));

    try {
      const response = await fetch('/api/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albums: albumDataForPlaylist }),
      });
      const data = await response.json();

      if (response.status === 401 && data.authorizeURL) {
        sessionStorage.setItem('pendingAlbumsForPlaylist', JSON.stringify(albums));
        setPlaylistMessage('Please authorize with Spotify to continue.');
        window.location.href = data.authorizeURL;
      } else if (response.ok) {
        setPlaylistUrl(data.playlistUrl);
        // Define a type for the elements in data.details
        type ProcessedAlbumDetail = {
          name: string;
          artist: string;
          id: string;
          selectedTrackUris?: string[];
          selectedTracksDetails?: Array<{ name: string; popularity: number }>;
        };
        const trackCount = data.details?.reduce((sum: number, ad: ProcessedAlbumDetail) => sum + (ad.selectedTrackUris?.length || 0), 0) || 0;
        setPlaylistMessage(`Playlist created! ${trackCount} unique tracks added.`);
        sessionStorage.removeItem('pendingAlbumsForPlaylist');
      } else {
        setPlaylistMessage(data.message || 'Failed to create playlist. Spotify API might be busy or an unknown error occurred.');
        console.error('Playlist creation API error:', data);
      }
    } catch (err: unknown) {
      console.error('Network or unexpected error during playlist creation:', err);
      const message = err instanceof Error ? err.message : 'An unexpected error occurred while creating the playlist. Check your connection and try again.';
      setPlaylistMessage(message);
    } finally {
      setPlaylistLoading(false);
    }
  }, [albums]); // Dependencies for useCallback: albums (used directly and in albumDataForPlaylist)

  // Effect to load username from localStorage and handle Spotify OAuth redirect parameters
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }

    const queryParams = new URLSearchParams(window.location.search);
    const spotifyAuthSuccess = queryParams.get('spotify_auth_success');
    const spotifyAuthError = queryParams.get('error');
    const spotifyAuthErrorReason = queryParams.get('reason');

    if (spotifyAuthSuccess) {
      setPlaylistMessage('Successfully connected to Spotify! Checking for pending playlist task...');
      window.history.replaceState({}, document.title, window.location.pathname); // Clear query params
    } else if (spotifyAuthError) {
      setPlaylistMessage(`Spotify connection failed: ${spotifyAuthErrorReason || spotifyAuthError}. Please try again.`);
      window.history.replaceState({}, document.title, window.location.pathname); // Clear query params
    }
  }, []); // Runs once on mount


  const fetchTopAlbums = async () => {
    if (!username) {
      setError('Please enter a LastFM username.');
      return;
    }
    setLoading(true);
    setError('');
    setAlbums([]);
    setSpotifyLinks({});
    setPlaylistUrl('');
    setPlaylistMessage('');

    try {
      const response = await fetch(
        `/api/albums?username=${encodeURIComponent(username)}&period=${timeRange}`
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch albums from Last.fm');
      }
      const data = await response.json();
      if (!data.topalbums || !data.topalbums.album) {
        throw new Error('No album data returned from Last.fm.');
      }
      const albumData = data.topalbums.album.slice(0, 9).map((album: Album) => ({
        name: album.name,
        artist: album.artist,
        image: album.image,
        mbid: album.mbid,
        playcount: Number(album.playcount),
      }));
      setAlbums(albumData);
      localStorage.setItem('username', username);
    } catch (err: unknown) {
      console.error('An error occurred while fetching albums: ', err);
      const message = err instanceof Error ? err.message : 'Error fetching albums. Please check the username and try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // const handleImageLoad = (index: number) => { // Removed as unused
  //   setImageLoadingStates(prev => ({ ...prev, [index]: true }));
  // };

  useEffect(() => {
    // setImageLoadingStates({}); // Removed as unused
    if (albums.length > 0) {
      const initialFadeInStates = albums.reduce((acc, _, index) => {
        acc[index] = false;
        return acc;
      }, {} as { [key: number]: boolean });
      setFadeInStates(initialFadeInStates);

      const timer = setTimeout(() => {
        const activeFadeInStates = albums.reduce((acc, _, index) => {
          acc[index] = true;
          return acc;
        }, {} as { [key: number]: boolean });
        setFadeInStates(activeFadeInStates);
      }, 20);
      return () => clearTimeout(timer);
    } else {
      setFadeInStates({});
    }
  }, [albums]);

  useEffect(() => {
    if (albums.length === 0) {
      setSpotifyLinks({});
      return;
    }
    albums.forEach(album => {
      const albumKey = album.mbid || album.name;
      if (!albumKey) {
        console.warn('Album missing mbid and name, cannot fetch Spotify link:', album);
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
              [albumKey]: data.spotifyUrl || null,
            }));
          } else {
            console.error(`Failed to fetch Spotify link for ${album.name}: ${response.status}`);
            setSpotifyLinks(prevLinks => ({ ...prevLinks, [albumKey]: null }));
          }
        } catch (err) {
          console.error(`Error fetching Spotify link for ${album.name}:`, err);
          setSpotifyLinks(prevLinks => ({ ...prevLinks, [albumKey]: null }));
        }
      };
      fetchSpotifyLink();
    });
  }, [albums]);

  const generateImage = async () => {
    if (!canvasRef.current || albums.length === 0) {
        setError("No albums to generate an image.");
        return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 900;
    canvas.height = 900;
    const isDarkTheme = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDarkTheme ? '#020817' : '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        if (!url) {
          const fallbackImg = document.createElement('img');
          fallbackImg.src = '/placeholder_album.png';
          fallbackImg.onload = () => resolve(fallbackImg);
          fallbackImg.onerror = () => reject(new Error('Failed to load placeholder image for missing URL.'));
          return;
        }
        const img = document.createElement('img');
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => {
          console.warn(`Failed to load image: ${url}. Using placeholder.`);
          const fallbackImg = document.createElement('img');
          fallbackImg.src = '/placeholder_album.png';
          fallbackImg.onload = () => resolve(fallbackImg);
          fallbackImg.onerror = () => reject(new Error(`Failed to load primary image and placeholder for ${url}`));
        };
        img.src = url;
      });
    };

    try {
      for (let i = 0; i < Math.min(albums.length, 9); i++) {
        const x = (i % 3) * 300;
        const y = Math.floor(i / 3) * 300;
        try {
          const imageUrl = albums[i].image.find(img => img.size === 'extralarge')?.['#text'] ||
                           albums[i].image.find(img => img.size === 'large')?.['#text'] ||
                           albums[i].image[0]?.['#text'];
          const img = await loadImage(imageUrl || '');
          ctx.drawImage(img, x, y, 300, 300);
        } catch (error) {
          console.error('Image failed to load for canvas: ', error);
          ctx.fillStyle = isDarkTheme ? '#1f2937' : '#e5e7eb';
          ctx.fillRect(x, y, 300, 300);
          ctx.fillStyle = isDarkTheme ? '#9ca3af' : '#4b5563';
          ctx.font = '16px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Image N/A', x + 150, y + 150);
        }
      }

      ctx.fillStyle = isDarkTheme ? 'rgba(2, 8, 23, 0.7)' : 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
      ctx.fillStyle = isDarkTheme ? '#FFFFFF' : '#000000';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${username}'s Top Albums - ${timeRanges[timeRange as keyof typeof timeRanges]}`, canvas.width / 2, canvas.height - 10);

      const link = document.createElement('a');
      link.download = `${username}-${timeRange}-albums.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
      setError('');
    } catch (error) {
      console.error('Error generating image:', error);
      setError('Error generating image. Please ensure images are accessible or try again.');
    }
  };

  // useEffect for handling automatic playlist creation after Spotify auth
  useEffect(() => {
    const pendingAlbumsJson = sessionStorage.getItem('pendingAlbumsForPlaylist');
    if (pendingAlbumsJson && albums.length > 0 && !loading) {
      console.log("Spotify auth was successful, pending albums found, and albums state is populated. Retrying playlist creation automatically.");
      setPlaylistMessage('Re-attempting playlist creation after Spotify authorization...');
      handleCreatePlaylist();
    } else if (pendingAlbumsJson && albums.length === 0 && !loading) {
        setPlaylistMessage("Spotify connected! Please generate your album grid again, then click 'Create Spotify Playlist'.");
    }
  }, [albums, loading, handleCreatePlaylist]);

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-8 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <Input
                type="text"
                placeholder="LastFM Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1"
                aria-label="LastFM Username"
              />
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-full md:w-[180px]" aria-label="Select time range">
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
                disabled={loading || playlistLoading}
                className="w-full md:w-auto gap-2"
              >
                <ListMusic size={16}/>
                {loading ? 'Fetching Albums...' : 'Generate Grid'}
              </Button>
              <ThemeToggleButton />
            </div>
            {error && <p className="text-red-500 dark:text-red-400 mt-4 p-3 bg-red-50 dark:bg-red-900/30 rounded-md flex items-center gap-2"><AlertTriangle size={16}/> {error}</p>}
          </CardContent>
        </Card>

        {albums.length > 0 && !loading && (
          <div className="my-6">
            <div className="flex flex-col sm:flex-row justify-center sm:justify-end gap-4 mb-4">
              <Button onClick={handleCreatePlaylist} disabled={playlistLoading || loading} className="gap-2 w-full sm:w-auto">
                <Music size={16} />
                {playlistLoading ? 'Creating Playlist...' : 'Create Spotify Playlist'}
              </Button>
              <Button onClick={generateImage} disabled={loading || albums.length === 0} className="gap-2 w-full sm:w-auto" title={albums.length === 0 ? "No albums to download" : "Download album grid image"}>
                <Download size={16} />
                Download Grid
              </Button>
            </div>
          </div>
        )}

        {playlistMessage && (
          <Card className="mb-6 shadow-md">
            <CardContent className="pt-6">
              <div className={`text-sm p-3 rounded-md flex items-start gap-3 ${playlistUrl ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' : (playlistMessage.toLowerCase().includes('failed') || playlistMessage.toLowerCase().includes('error')) ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'}`}>
                {playlistUrl ? <CheckCircle size={20} className="flex-shrink-0"/> : (playlistMessage.toLowerCase().includes('failed') || playlistMessage.toLowerCase().includes('error')) ? <AlertTriangle size={20} className="flex-shrink-0"/> : <Music size={20} className="flex-shrink-0"/>}
                <div>
                  {playlistMessage}
                  {playlistUrl && (
                    <a href={playlistUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline ml-1 hover:opacity-80 flex items-center gap-1 mt-1">
                      Open Playlist on Spotify <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {loading && albums.length === 0 && <p className="text-center text-muted-foreground py-10">Loading albums...</p>}
        {!loading && albums.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {albums.map((album, index) => {
                const albumKey = album.mbid || `${album.artist.name}-${album.name}-${index}`;
                const currentSpotifyUrl = spotifyLinks[album.mbid || album.name];
                const mainImage = album.image.find(img => img.size === 'extralarge')?.['#text'] ||
                                  album.image.find(img => img.size === 'large')?.['#text'] ||
                                  album.image.find(img => img.size === 'medium')?.['#text'] ||
                                  album.image[0]?.['#text'] ||
                                  '/placeholder_album.png';

                return (
                  <Card key={albumKey} className={`shadow-lg transition-all duration-300 ease-in-out ${fadeInStates[index] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'} hover:shadow-xl`}>
                    <CardContent className="p-0">
                      <div className="aspect-square relative group album-hover-container overflow-hidden rounded-t-md">
                        <Image
                          src={mainImage}
                          alt={`Album art for ${album.name} by ${album.artist.name}`}
                          fill
                          className={`object-cover transition-transform duration-300 ease-in-out group-hover:scale-105 ${currentSpotifyUrl ? 'group-hover:opacity-75' : ''}`}
                          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                          // onLoad={() => handleImageLoad(index)} // Removed as unused
                          onError={(e) => { e.currentTarget.src = '/placeholder_album.png'; }}
                        />
                        {currentSpotifyUrl && (
                          <a
                            href={currentSpotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black bg-opacity-50"
                            aria-label={`Play ${album.name} on Spotify`}
                          >
                            <Image
                              src="/spotify_icon.svg"
                              alt="Play on Spotify"
                              width={56}
                              height={56}
                              className="w-14 h-14"
                            />
                          </a>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="font-semibold truncate text-lg" title={album.name}>
                          <a href={album.mbid ? `https://musicbrainz.org/release/${album.mbid}` : undefined} target="_blank" rel="noopener noreferrer" className="hover:underline">{album.name}</a>
                        </p>
                        <p className="text-sm text-muted-foreground truncate" title={album.artist.name}>
                          <a href={album.artist.mbid ? `https://musicbrainz.org/artist/${album.artist.mbid}` : undefined} target="_blank" rel="noopener noreferrer" className="hover:underline">{album.artist.name}</a>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
        )}
        {!loading && albums.length === 0 && !error && username && <p className="text-center text-muted-foreground py-10">No albums found for this user and period. Try a different time range.</p>}
        {!loading && albums.length === 0 && !error && !username && <p className="text-center text-muted-foreground py-10">Enter a LastFM username to see album grids.</p>}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}