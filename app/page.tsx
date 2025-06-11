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
  const [imageLoadingStates, setImageLoadingStates] = useState<{ [key: number]: boolean }>({});
  const [fadeInStates, setFadeInStates] = useState<{ [key: number]: boolean }>({});
  const [spotifyLinks, setSpotifyLinks] = useState<Record<string, string | null>>({});
  const [logoColorStates, setLogoColorStates] = useState<Record<string, 'light' | 'dark'>>({});
  const [isGridUpdating, setIsGridUpdating] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false); // New state for spinner
  const [spotifyCueVisible, setSpotifyCueVisible] = useState<Record<string, boolean>>({});

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
    setIsGridUpdating(true); // Set isGridUpdating to true
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
      setIsGridUpdating(false); // Set isGridUpdating to false
    } catch (err) {
      console.error('An error occurred: ', err);
      setError('Error fetching albums. Please check the username and try again.');
    } finally {
      setLoading(false);
  setIsGridUpdating(false); // Ensure isGridUpdating is reset
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
          ctx.font = '14px Inter';
          ctx.textAlign = 'center';
          ctx.fillText('Image not available', x + 150, y + 150);
        }
      }

      // Add watermark
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
      ctx.fillStyle = '#000000';
      ctx.font = '16px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(`${username}'s Top Albums - ${timeRanges[timeRange as keyof typeof timeRanges]}`, canvas.width / 2, canvas.height - 10);

      // Open image in a new tab (revised approach)
      const imageURL = canvas.toDataURL('image/jpeg', 0.8);
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write('<html><head><title>Album Grid</title></head><body><img src="' + imageURL + '" style="display: block; margin: auto; max-width: 100%; max-height: 100vh;"></body></html>');
        newWindow.document.close(); // Important for some browsers
      } else {
        // Fallback or error message if popup was blocked
        //alert('Failed to open new tab. Please disable your popup blocker and try again.');
        // Optionally, revert to direct download as a fallback:
        const link = document.createElement('a');
        link.download = `${username}-${timeRange}-albums.jpg`;
        link.href = imageURL;
        link.click();
      }
    } catch (error) {
      console.error('Error generating image:', error);
      setError('Error generating image. Please try again.');
    }
  };

  const handleImageLoad = (index: number) => {
    setImageLoadingStates(prev => ({ ...prev, [index]: true }));
    setFadeInStates(prev => ({ ...prev, [index]: true }));
  };

  useEffect(() => {
    setImageLoadingStates({});
    if (albums.length > 0) {
      const initialFadeInStates = albums.reduce((acc, _, index) => {
        acc[index] = false;
        return acc;
      }, {} as { [key: number]: boolean });
      setFadeInStates(initialFadeInStates);

      setTimeout(() => {
        const activeFadeInStates = albums.reduce((acc, _, index) => {
          acc[index] = true;
          return acc;
        }, {} as { [key: number]: boolean });
        setFadeInStates(activeFadeInStates);
      }, 20);
    } else {
      setFadeInStates({});
    }
  }, [albums]);

  // Function to determine logo background type (moved outside of useEffect)
  const getLogoBackgroundColorType = (imageUrl: string, albumKey: string) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const sampleSize = 64; // Matching logo size
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('Failed to get canvas context for logo color analysis');
        setLogoColorStates(prev => ({ ...prev, [albumKey]: 'dark' })); // Default to dark
        return;
      }

      // Calculate source x, y to sample center of the image
      const sourceX = (img.naturalWidth - sampleSize) / 2;
      const sourceY = (img.naturalHeight - sampleSize) / 2;

      ctx.drawImage(img, sourceX, sourceY, sampleSize, sampleSize, 0, 0, sampleSize, sampleSize);

      const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
      let totalBrightness = 0;
      for (let i = 0; i < imageData.length; i += 4) {
        const brightness = (0.299 * imageData[i] + 0.587 * imageData[i+1] + 0.114 * imageData[i+2]);
        totalBrightness += brightness;
      }
      const avgBrightness = totalBrightness / (sampleSize * sampleSize);
      const type = avgBrightness > 128 ? 'light' : 'dark';
      setLogoColorStates(prev => ({ ...prev, [albumKey]: type }));
    };
    img.onerror = () => {
      console.error('Error loading image for logo color analysis:', imageUrl);
      setLogoColorStates(prev => ({ ...prev, [albumKey]: 'dark' })); // Default to dark on error
    };
    img.src = imageUrl;
  };

  // useEffect to fetch Spotify links and determine logo color when albums change
  useEffect(() => {
    setLogoColorStates({}); // Clear logo color states on new album fetch or when albums are cleared
    setSpotifyCueVisible({}); // Clear cue visibility states
    if (albums.length === 0) {
      setSpotifyLinks({}); // Clear links if no albums
      return;
    }

    setSpotifyLinks({}); // Reset links before fetching for new set of albums

    albums.forEach(album => {
      if (!album.mbid) { // Ensure we have a key for spotify link and logo color
        console.warn('Album missing mbid, cannot fetch Spotify link or analyze logo color:', album.name);
        // Set cue visibility to false if mbid is missing
        setSpotifyCueVisible(prev => ({ ...prev, [album.name]: false })); // Use album.name as a fallback key if mbid is missing
        return;
      }

      // Fetch Spotify link
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
            setSpotifyCueVisible(prevCues => ({
              ...prevCues,
              [album.mbid]: !!data.spotifyUrl, // True if link exists, false otherwise
            }));
          } else {
            console.error(`Failed to fetch Spotify link for ${album.name}: ${response.status}`);
            setSpotifyLinks(prevLinks => ({
              ...prevLinks,
              [album.mbid]: null,
            }));
            setSpotifyCueVisible(prevCues => ({
              ...prevCues,
              [album.mbid]: false,
            }));
          }
        } catch (err) {
          console.error(`Error fetching Spotify link for ${album.name}:`, err);
          setSpotifyLinks(prevLinks => ({
            ...prevLinks,
            [album.mbid]: null,
          }));
          setSpotifyCueVisible(prevCues => ({
            ...prevCues,
            [album.mbid]: false,
          }));
        }
      };

      fetchSpotifyLink();

      // Analyze album art for logo color
      if (album.image[3]?.['#text']) {
        getLogoBackgroundColorType(album.image[3]['#text'], album.mbid);
      } else {
        // If no image, default to dark background for logo
        setLogoColorStates(prev => ({ ...prev, [album.mbid]: 'dark' }));
        // Also ensure cue visibility is false if there's no image for logo analysis (though this is more tied to Spotify link)
        // This part might be redundant if already handled by Spotify link logic, but ensures consistency if mbid exists but image doesn't
        if (!spotifyCueVisible[album.mbid]) { // Check if not already set by link fetching
            setSpotifyCueVisible(prevCues => ({ ...prevCues, [album.mbid]: false }));
        }
      }
    });
  }, [albums]); // Dependency: albums array itself

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isGridUpdating) {
      // When grid starts updating, set a timer to show spinner after fade-out
      timer = setTimeout(() => {
        setShowSpinner(true);
      }, 500); // Corresponds to fade-out duration
    } else {
      // When grid is not updating (or update finished), hide spinner immediately
      setShowSpinner(false);
    }
    return () => clearTimeout(timer); // Cleanup timer
  }, [isGridUpdating]);

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

        {showSpinner && (
          <div data-testid="loading-spinner" style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10, // Ensure it's above other content
          }}>
            <div style={{
              border: '4px solid rgba(0, 0, 0, 0.1)',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              borderLeftColor: 'var(--foreground)', // Use theme color
              animation: 'spin 1s ease infinite',
            }}></div>
          </div>
        )}

        {albums.length > 0 && !showSpinner && ( // Also hide grid if spinner is shown
          <>
            <div className="flex justify-end mb-4">
              <Button onClick={generateImage} className="gap-2">
                <Download size={16} />
                Download Grid
              </Button>
            </div>
            <div data-testid="album-grid-container" className={`grid grid-cols-3 gap-4 ${isGridUpdating ? 'grid-fade-out-active' : ''}`}>
              {albums.map((album, index) => {
                const currentSpotifyUrl = album.mbid ? spotifyLinks[album.mbid] : null;
                const logoBgType = album.mbid ? logoColorStates[album.mbid] : 'dark'; // Default if not found
                const showCue = album.mbid ? spotifyCueVisible[album.mbid] : false;
                return (
                  <Card key={album.mbid || index}> {/* Use mbid as key if available */}
                    <CardContent className="p-4">
                      <div className="aspect-square relative group album-hover-container">
                        <Image
                          src={album.image[3]?.['#text'] || '/api/placeholder/300/300'}
                          alt={`${album.name} by ${album.artist.name}`}
                          fill
                          className={`object-cover ${currentSpotifyUrl ? 'group-hover:opacity-70' : ''} ${fadeInStates[index] ? 'image-fade-enter-active' : 'image-fade-enter'}`}
                          sizes="(max-width: 768px) 100vw, 300px"
                          onLoad={() => handleImageLoad(index)}
                        />
                        {showCue && (
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
                        {currentSpotifyUrl && (
                          <a
                            href={currentSpotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 spotify-icon-overlay ${logoBgType === 'light' ? 'spotify-logo-light-bg' : 'spotify-logo-dark-bg'}`}
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
    </div>
  );
}
