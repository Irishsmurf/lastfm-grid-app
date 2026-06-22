// app/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
// Removed direct Firebase SDK imports for FTUE: getRemoteConfig, getValue, getApp
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils'; // Added for conditional classnames
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileImage, Share2, Check } from 'lucide-react'; // Added Share2, Check
import { ThemeToggleButton } from '@/components/theme-toggle-button';
import type { MinimizedAlbum } from '@/lib/minimizedLastfmService'; // Import MinimizedAlbum
import {
  getRemoteConfigValue, // This will be used for FTUE and default_time_period
  defaultRemoteConfig,
} from '@/lib/firebase'; // Updated path if necessary, assuming it's correct

const timeRanges = {
  '7day': 'Last Week',
  '1month': 'Last Month',
  '3month': 'Last 3 Months',
  '6month': 'Last 6 Months',
  '12month': 'Last Year',
  overall: 'Overall',
};

interface Album {
  // This is the local interface in app/page.tsx
  name: string;
  artist: Artist;
  imageUrl: string; // Changed from image: Array<AlbumImage>
  mbid: string;
  playcount: number;
}

interface Artist {
  name: string;
  url: string;
  mbid: string;
}

export default function Home() {
  const [username, setUsername] = useState('');
  const [timeRange, setTimeRange] = useState(
    defaultRemoteConfig.default_time_period
  );
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [jpgImageCache, setJpgImageCache] = useState<{
    withLabels: string;
    withoutLabels: string;
  }>({ withLabels: '', withoutLabels: '' });
  const [isJpgView, setIsJpgView] = useState<boolean>(false);
  const [fadeInStates, setFadeInStates] = useState<{ [key: number]: boolean }>(
    {}
  );
  const [spotifyLinks, setSpotifyLinks] = useState<
    Record<string, string | null>
  >({});
  const [logoColorStates, setLogoColorStates] = useState<
    Record<string, 'light' | 'dark'>
  >({});
  const [isGridUpdating, setIsGridUpdating] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false); // New state for spinner
  const [spotifyCueVisible, setSpotifyCueVisible] = useState<
    Record<string, boolean>
  >({});
  const [sharedId, setSharedId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [gridSize, setGridSize] = useState<9 | 16 | 25>(9);
  const [showAlbumLabels, setShowAlbumLabels] = useState(false);
  const [jpgGenerationCount, setJpgGenerationCount] = useState(0);

  // FTUE States
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [ftueEnabled, setFtueEnabled] = useState(
    defaultRemoteConfig.ftue_enabled
  ); // Default to true as per spec
  const [welcomeMessageVariant, setWelcomeMessageVariant] = useState(
    defaultRemoteConfig.welcome_message_variant
  );
  const [welcomeMessageTextShort, setWelcomeMessageTextShort] = useState(
    defaultRemoteConfig.welcome_message_text_short
  );
  const [welcomeMessageTextDetailed, setWelcomeMessageTextDetailed] = useState(
    defaultRemoteConfig.welcome_message_text_detailed
  );
  const [highlightInitialAction, setHighlightInitialAction] = useState(
    defaultRemoteConfig.highlight_initial_action
  );
  const [_prefillExampleUsername, setPrefillExampleUsername] = useState(
    defaultRemoteConfig.prefill_example_username
  );
  const [_exampleUsernameValue, setExampleUsernameValue] = useState(
    defaultRemoteConfig.example_username_value
  );

  // Combined useEffect for localStorage and FTUE logic
  useEffect(() => {
    // First-time user check (runs only on client)
    const hasVisitedBefore = localStorage.getItem('has_visited_before');
    if (!hasVisitedBefore) {
      localStorage.setItem('has_visited_before', 'true');
      setIsFirstTimeUser(true);
    }

    // Load username from localStorage
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }

    // FTUE Logic - Fetch and Apply Remote Config if it's a first-time user
    // This relies on Firebase app being initialized and Remote Config fetched by layout.tsx via lib/firebase.ts
    if (!hasVisitedBefore) {
      // Only run FTUE Remote Config value retrieval for actual first-time users in this session
      try {
        // Use getRemoteConfigValue from lib/firebase.ts
        setFtueEnabled(getRemoteConfigValue('ftue_enabled').asBoolean());
        setWelcomeMessageVariant(
          getRemoteConfigValue('welcome_message_variant').asString()
        );
        setWelcomeMessageTextShort(
          getRemoteConfigValue('welcome_message_text_short').asString()
        );
        setWelcomeMessageTextDetailed(
          getRemoteConfigValue('welcome_message_text_detailed').asString()
        );
        setHighlightInitialAction(
          getRemoteConfigValue('highlight_initial_action').asString()
        );

        const shouldPrefill = getRemoteConfigValue(
          'prefill_example_username'
        ).asBoolean();
        setPrefillExampleUsername(shouldPrefill);
        const exampleUser = getRemoteConfigValue(
          'example_username_value'
        ).asString();
        setExampleUsernameValue(exampleUser);

        if (shouldPrefill && !storedUsername && exampleUser) {
          setUsername(exampleUser);
          // Do NOT save this example username to localStorage immediately,
          // let the normal flow save it if the user proceeds.
        }
        console.log(
          'FTUE: Remote config values applied for first-time user using lib/firebase.'
        );
      } catch (error) {
        console.error(
          'FTUE: Error getting remote config values for FTUE using lib/firebase:',
          error
        );
        // Defaults set in useState will be used, which should align with those in lib/firebase.ts defaultRemoteConfig
      }
    }
  }, []); // Empty dependency array: runs once on mount

  // Separate useEffect for existing remote config logic (default_time_period)
  // This ensures it runs independently of FTUE logic.
  useEffect(() => {
    const fetchDefaultTimePeriod = async () => {
      try {
        // initializeRemoteConfig from lib/firebase is now called in layout.tsx.
        // So, it should have already fetched and activated by the time this component mounts.
        // We can directly try to get the value.
        // If `initializeRemoteConfig` in lib also ensures defaults are loaded synchronously before fetch, this is fine.
        // Otherwise, if there's a slight delay, it might pick up the lib's internal default.
        const remoteTimePeriodValue = getRemoteConfigValue(
          'default_time_period'
        );
        let remoteTimePeriod = remoteTimePeriodValue.asString();

        // Fallback if the value from remote config is empty or somehow not yet available
        if (!remoteTimePeriod && defaultRemoteConfig.default_time_period) {
          remoteTimePeriod = defaultRemoteConfig.default_time_period;
          console.warn(
            `'default_time_period' was empty from Remote Config, using in-lib default: '${remoteTimePeriod}'.`
          );
        }

        if (remoteTimePeriod && remoteTimePeriod in timeRanges) {
          setTimeRange(remoteTimePeriod);
        } else {
          // Fallback to a hardcoded '1month' if even the lib default is invalid or not in timeRanges
          setTimeRange('1month');
          console.warn(
            `Invalid or missing 'default_time_period' in Remote Config: '${remoteTimePeriod}'. Using hardcoded default '1month'.`
          );
        }
      } catch (error) {
        console.error(
          'Error fetching default time period from Remote Config (using lib):',
          error
        );
        setTimeRange(defaultRemoteConfig.default_time_period || '1month'); // Fallback on error
      }
    };

    fetchDefaultTimePeriod();
  }, []);

  const fetchTopAlbums = async () => {
    setIsJpgView(false); // Add this line
    if (!username) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setIsGridUpdating(true); // Set isGridUpdating to true
    setError('');
    setSharedId(null); // Reset sharedId on new fetch
    setShareCopied(false); // Reset share copied status

    try {
      const response = await fetch(
        `/api/albums?username=${encodeURIComponent(username)}&period=${timeRange}&limit=${gridSize}`
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Failed to parse error response' }));
        throw new Error(errorData.message || 'Failed to fetch albums');
      }

      const responseData = await response.json();

      if (responseData && Array.isArray(responseData.albums)) {
        // responseData.albums is MinimizedAlbum[]
        // MinimizedAlbum has: name: string, artist: { name: string, mbid: string }, imageUrl: string, mbid: string, playcount: number
        const albumData: Album[] = responseData.albums
          .slice(0, gridSize)
          .map((apiAlbum: MinimizedAlbum) => ({
            // Changed any to MinimizedAlbum
            name: apiAlbum.name,
            artist: {
              name: apiAlbum.artist.name,
              mbid: apiAlbum.artist.mbid,
              url: '', // Local Album interface has url, MinimizedAlbum's artist does not
            },
            imageUrl: apiAlbum.imageUrl,
            mbid: apiAlbum.mbid,
            playcount: apiAlbum.playcount,
          }));

        setAlbums(albumData);
        setJpgGenerationCount(0);

        if (typeof responseData.sharedId === 'string') {
          setSharedId(responseData.sharedId);
        } else if (responseData.sharedId === null && responseData.error) {
          setSharedId(null);
          //setError('Fetched albums, but could not generate a shareable link. The grid is not shareable at the moment.');
          console.warn(
            'app/page.tsx: Fetched albums, but sharedId was null, Redis error likely occurred.'
          );
        } else {
          setSharedId(null); // If sharedId is not a string and no specific error for it, just set to null
        }

        if (albumData.length === 0) {
          setError('No albums found for this user and period.');
        }
      } else {
        console.error('Invalid API response structure', responseData);
        throw new Error('Invalid API response structure.');
      }

      // Save username to localStorage after successful fetch
      localStorage.setItem('username', username);
      setIsGridUpdating(false); // Set isGridUpdating to false
    } catch (err: Error | unknown) {
      console.error('An error occurred: ', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred. Please check the console.');
        console.error('Unknown error details:', err);
      }
      setSharedId(null); // Ensure sharedId is reset on error
      setAlbums([]); // Clear albums on error
    } finally {
      setLoading(false);
      setIsGridUpdating(false); // Ensure isGridUpdating is reset
    }
  };

  const generateImage = async (withLabels?: boolean) => {
    if (!canvasRef.current || albums.length === 0) return;
    if (jpgGenerationCount >= 2) return;
    setJpgGenerationCount((c) => c + 1);
    const labelsEnabled = withLabels ?? showAlbumLabels;

    const cols = Math.round(Math.sqrt(albums.length));
    const cellSize = 900 / cols;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 900;
    canvas.height = 900;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        if (!url) {
          reject(new Error('No image URL provided'));
          return;
        }

        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
          const fallbackImg = document.createElement('img');
          fallbackImg.src = '/api/placeholder/300/300';
          fallbackImg.onload = () => resolve(fallbackImg);
          fallbackImg.onerror = () =>
            reject(new Error('Failed to load placeholder image'));
        };
        img.src = url;
      });
    };

    try {
      for (let i = 0; i < albums.length; i++) {
        const x = (i % cols) * cellSize;
        const y = Math.floor(i / cols) * cellSize;

        try {
          const img = await loadImage(albums[i].imageUrl);
          ctx.drawImage(img, x, y, cellSize, cellSize);

          if (labelsEnabled) {
            const padding = 4;
            const albumFontSize = Math.max(9, Math.round(cellSize / 25));
            const artistFontSize = Math.max(8, Math.round(cellSize / 28));
            const barHeight = albumFontSize + artistFontSize + padding * 3;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(x, y + cellSize - barHeight, cellSize, barHeight);

            ctx.textAlign = 'left';
            const maxTextWidth = cellSize - padding * 2;

            const truncateText = (
              text: string | undefined | null,
              font: string,
              maxWidth: number
            ) => {
              if (!text) return '';
              ctx.font = font;
              if (ctx.measureText(text).width <= maxWidth) return text;
              let truncated = text;
              while (
                truncated.length > 0 &&
                ctx.measureText(truncated + '...').width > maxWidth
              ) {
                truncated = truncated.slice(0, -1);
              }
              return truncated + '...';
            };

            const albumFont = `bold ${albumFontSize}px Inter, sans-serif`;
            const artistFont = `${artistFontSize}px Inter, sans-serif`;

            ctx.fillStyle = '#FFFFFF';
            ctx.font = albumFont;
            ctx.fillText(
              truncateText(albums[i].name, albumFont, maxTextWidth),
              x + padding,
              y + cellSize - barHeight + albumFontSize + padding
            );

            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = artistFont;
            ctx.fillText(
              truncateText(albums[i].artist.name, artistFont, maxTextWidth),
              x + padding,
              y + cellSize - padding - 1
            );
          }
        } catch (error) {
          console.log('Image failed to load: ', error);
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(x, y, cellSize, cellSize);
          ctx.fillStyle = '#666666';
          ctx.font = '14px Inter';
          ctx.textAlign = 'center';
          ctx.fillText(
            'Image not available',
            x + cellSize / 2,
            y + cellSize / 2
          );
        }
      }

      const imageURL = canvas.toDataURL('image/jpeg', 0.8);
      setJpgImageCache((prev) => ({
        ...prev,
        [labelsEnabled ? 'withLabels' : 'withoutLabels']: imageURL,
      }));
      setIsJpgView(true);
    } catch (error) {
      console.error('Error generating image:', error);
      setError('Error generating image. Please try again.');
    }
  };

  const handleImageLoad = (index: number) => {
    setFadeInStates((prev) => ({ ...prev, [index]: true }));
  };

  useEffect(() => {
    if (albums.length > 0) {
      const initialFadeInStates = albums.reduce(
        (acc, _, index) => {
          acc[index] = false;
          return acc;
        },
        {} as { [key: number]: boolean }
      );
      setFadeInStates(initialFadeInStates);

      setTimeout(() => {
        const activeFadeInStates = albums.reduce(
          (acc, _, index) => {
            acc[index] = true;
            return acc;
          },
          {} as { [key: number]: boolean }
        );
        setFadeInStates(activeFadeInStates);
      }, 20);
    } else {
      setFadeInStates({});
    }
  }, [albums]);

  // Function to determine logo background type (moved outside of useEffect)
  const getLogoBackgroundColorType = (imageUrl: string, albumKey: string) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const sampleSize = 64; // Matching logo size
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('Failed to get canvas context for logo color analysis');
        setLogoColorStates((prev) => ({ ...prev, [albumKey]: 'dark' })); // Default to dark
        return;
      }

      // Calculate source x, y to sample center of the image
      const sourceX = (img.naturalWidth - sampleSize) / 2;
      const sourceY = (img.naturalHeight - sampleSize) / 2;

      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sampleSize,
        sampleSize,
        0,
        0,
        sampleSize,
        sampleSize
      );

      const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
      let totalBrightness = 0;
      for (let i = 0; i < imageData.length; i += 4) {
        const brightness =
          0.299 * imageData[i] +
          0.587 * imageData[i + 1] +
          0.114 * imageData[i + 2];
        totalBrightness += brightness;
      }
      const avgBrightness = totalBrightness / (sampleSize * sampleSize);
      const type = avgBrightness > 128 ? 'light' : 'dark';
      setLogoColorStates((prev) => ({ ...prev, [albumKey]: type }));
    };
    img.onerror = () => {
      console.error('Error loading image for logo color analysis:', imageUrl);
      setLogoColorStates((prev) => ({ ...prev, [albumKey]: 'dark' })); // Default to dark on error
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

    albums.forEach((album) => {
      if (!album.mbid) {
        // Ensure we have a key for spotify link and logo color
        console.warn(
          'Album missing mbid, cannot fetch Spotify link or analyze logo color:',
          album.name
        );
        // Set cue visibility to false if mbid is missing
        setSpotifyCueVisible((prev) => ({ ...prev, [album.name]: false })); // Use album.name as a fallback key if mbid is missing
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
            setSpotifyLinks((prevLinks) => ({
              ...prevLinks,
              [album.mbid]: data.spotifyUrl || null,
            }));
            setSpotifyCueVisible((prevCues) => ({
              ...prevCues,
              [album.mbid]: !!data.spotifyUrl, // True if link exists, false otherwise
            }));
          } else {
            console.error(
              `Failed to fetch Spotify link for ${album.name}: ${response.status}`
            );
            setSpotifyLinks((prevLinks) => ({
              ...prevLinks,
              [album.mbid]: null,
            }));
            setSpotifyCueVisible((prevCues) => ({
              ...prevCues,
              [album.mbid]: false,
            }));
          }
        } catch (err) {
          console.error(`Error fetching Spotify link for ${album.name}:`, err);
          setSpotifyLinks((prevLinks) => ({
            ...prevLinks,
            [album.mbid]: null,
          }));
          setSpotifyCueVisible((prevCues) => ({
            ...prevCues,
            [album.mbid]: false,
          }));
        }
      };

      fetchSpotifyLink();

      // Analyze album art for logo color
      if (album.imageUrl) {
        // Updated image access
        getLogoBackgroundColorType(album.imageUrl, album.mbid);
      } else {
        // If no image, default to dark background for logo
        setLogoColorStates((prev) => ({ ...prev, [album.mbid]: 'dark' }));
        if (!spotifyCueVisible[album.mbid]) {
          // Check if not already set by link fetching
          setSpotifyCueVisible((prevCues) => ({
            ...prevCues,
            [album.mbid]: false,
          }));
        }
      }
    });
  }, [albums]); // Changed dependency array to [albums]

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

  const handleShareGrid = () => {
    if (!sharedId) {
      console.error('Share button clicked without a sharedId');
      return;
    }
    const url = window.location.origin + '/share/' + sharedId;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setShareCopied(true);
        setTimeout(() => {
          setShareCopied(false);
        }, 2000); // Reset after 2 seconds
      })
      .catch((err) => {
        console.error('Failed to copy share link: ', err);
        // Optionally, set an error state here to inform the user
      });
  };

  const handleToggleView = () => {
    if (isJpgView) {
      setIsJpgView(false);
      setJpgImageCache({ withLabels: '', withoutLabels: '' });
      setJpgGenerationCount(0);
    } else {
      generateImage();
    }
  };

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
          <p className="mt-4 text-xs tracking-[0.18em] uppercase text-muted-foreground font-medium">
            Your listening history · your art
          </p>
        </header>

        {/* FTUE Welcome Message */}
        {isFirstTimeUser && ftueEnabled && welcomeMessageVariant !== 'none' && (
          <div className="mt-6 rounded border border-border bg-secondary/50 px-5 py-4">
            <p className="text-center text-sm">
              {welcomeMessageVariant === 'short_intro' &&
                welcomeMessageTextShort}
              {welcomeMessageVariant === 'detailed_guide' &&
                welcomeMessageTextDetailed}
            </p>
          </div>
        )}

        {/* Form strip — editorial band between horizontal rules */}
        <div className="border-y border-border mt-8 py-5">
          <div className="flex flex-col md:flex-row gap-3 items-center">
            <Input
              type="text"
              placeholder="LastFM Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchTopAlbums()}
              className={cn(
                'flex-1 h-10',
                isFirstTimeUser &&
                  ftueEnabled &&
                  highlightInitialAction === 'username_input' &&
                  'animate-pulse border-2 border-brand-red ring-2 ring-brand-red/30'
              )}
            />
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-full md:w-[175px] h-10">
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
            <Select
              value={String(gridSize)}
              onValueChange={(v) => setGridSize(Number(v) as 9 | 16 | 25)}
            >
              <SelectTrigger className="w-full md:w-[105px] h-10">
                <SelectValue placeholder="Grid size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="9">3×3</SelectItem>
                <SelectItem value="16">4×4</SelectItem>
                <SelectItem value="25">5×5</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={fetchTopAlbums}
              disabled={loading}
              className={cn(
                'w-full md:w-auto h-10 px-6 font-semibold bg-brand-red hover:bg-brand-red-dark text-white',
                isFirstTimeUser &&
                  ftueEnabled &&
                  highlightInitialAction === 'generate_button' &&
                  'animate-pulse border-2 border-brand-red ring-2 ring-brand-red/30'
              )}
            >
              {loading ? 'Loading...' : 'Generate Grid'}
            </Button>
            <ThemeToggleButton />
          </div>
          {error && <p className="text-brand-red text-sm mt-3">{error}</p>}
        </div>

        {showSpinner && (
          <div
            data-testid="loading-spinner"
            className="fixed inset-0 flex items-center justify-center bg-black/30 z-50"
          >
            <div
              style={{
                border: '4px solid rgba(0, 0, 0, 0.1)',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                borderLeftColor: '#d51007',
                animation: 'spin 1s ease infinite',
              }}
            />
          </div>
        )}

        {albums.length > 0 && (
          <>
            {/* Results header: context + actions */}
            <div className="flex items-center justify-between mt-8 mb-3">
              <p className="text-sm">
                <span className="font-semibold text-brand-red">{username}</span>
                <span className="text-muted-foreground">
                  {' · '}
                  {timeRanges[timeRange as keyof typeof timeRanges]}
                </span>
              </p>
              <div className="flex gap-2">
                {sharedId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShareGrid}
                    disabled={shareCopied}
                    className="gap-1.5 h-8 text-xs"
                  >
                    {shareCopied ? (
                      <Check className="h-3 w-3 text-brand-success" />
                    ) : (
                      <Share2 size={13} />
                    )}
                    {shareCopied ? 'Copied!' : 'Share Grid'}
                  </Button>
                )}
                {isJpgView && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const next = !showAlbumLabels;
                      setShowAlbumLabels(next);
                      const cached = next
                        ? jpgImageCache.withLabels
                        : jpgImageCache.withoutLabels;
                      if (!cached) {
                        generateImage(next);
                      }
                    }}
                    disabled={
                      jpgGenerationCount >= 2 &&
                      !(showAlbumLabels
                        ? jpgImageCache.withoutLabels
                        : jpgImageCache.withLabels)
                    }
                    className={cn(
                      'gap-1.5 h-8 text-xs',
                      showAlbumLabels &&
                        'border-brand-red text-brand-red hover:text-brand-red-dark'
                    )}
                  >
                    {showAlbumLabels ? 'Labels On' : 'Labels Off'}
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleToggleView}
                  className="gap-1.5 h-8 text-xs bg-brand-red hover:bg-brand-red-dark text-white"
                >
                  {isJpgView ? (
                    'Revert to Grid'
                  ) : (
                    <>
                      <FileImage size={13} />
                      Convert to JPG
                    </>
                  )}
                </Button>
              </div>
            </div>

            {isJpgView &&
            (showAlbumLabels
              ? jpgImageCache.withLabels
              : jpgImageCache.withoutLabels) ? (
              <Image
                src={
                  showAlbumLabels
                    ? jpgImageCache.withLabels
                    : jpgImageCache.withoutLabels
                }
                alt="Album Grid JPG"
                width={900}
                height={900}
                className="w-full h-auto rounded shadow-lg"
                priority
              />
            ) : (
              <div
                data-testid="album-grid-container"
                className={`grid gap-1.5 ${isGridUpdating ? 'grid-fade-out-active' : ''}`}
                style={{
                  gridTemplateColumns: `repeat(${Math.round(Math.sqrt(albums.length))}, minmax(0, 1fr))`,
                }}
              >
                {albums.map((album, index) => {
                  const currentSpotifyUrl = album.mbid
                    ? spotifyLinks[album.mbid]
                    : null;
                  const logoBgType = album.mbid
                    ? logoColorStates[album.mbid]
                    : 'dark';
                  const showCue = album.mbid
                    ? spotifyCueVisible[album.mbid]
                    : false;
                  return (
                    <div
                      key={album.mbid || index}
                      className="album-grid-cell flex flex-col"
                    >
                      <div className="aspect-square relative group album-hover-container overflow-hidden">
                        <Image
                          src={album.imageUrl || '/api/placeholder/300/300'}
                          alt={`${album.name} by ${album.artist.name}`}
                          fill
                          className={`object-cover ${currentSpotifyUrl ? 'group-hover:opacity-70' : ''} ${fadeInStates[index] ? 'image-fade-enter-active' : 'image-fade-enter'}`}
                          sizes="(max-width: 768px) 50vw, 300px"
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
                              width={64}
                              height={64}
                              className="w-16 h-16"
                            />
                          </a>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-black/70 px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
                          <p className="text-white text-xs font-semibold truncate">
                            {album.name}
                          </p>
                          <p className="text-white/80 text-xs truncate">
                            {album.artist.name}
                          </p>
                        </div>
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
                        <p className="text-[11px] text-muted-foreground/60 leading-tight">
                          {album.playcount.toLocaleString()} plays
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
