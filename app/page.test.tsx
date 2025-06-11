// app/page.test.tsx
import React from 'react'; // Still good practice to have it for tests, though react-jsx might not strictly need it.
import { render, screen, fireEvent, act, within } from '@testing-library/react'; // Removed waitFor, Added within
import '@testing-library/jest-dom';
import Home from './page';

import { ImageProps } from 'next/image'; // Import for typing if possible, or define manually

// Mock Next.js Image component
interface MockImageProps extends Omit<ImageProps, 'src'> { // Omit src if it's always a string from import, or handle StaticImageData
  src: string;
  // Add other props if ImageProps is not directly usable or too complex for mock
  alt: string;
  width?: number | `${number}` | undefined;
  height?: number | `${number}` | undefined;
  className?: string;
  // Unused props from original code: fill, sizes, onLoad, priority
}

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: MockImageProps) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { src, alt, width, height, className, fill, ...rest } = props;
    // The `fill` prop is boolean in Next/Image. If true, it implies certain styles.
    // For a simple img mock, we don't replicate those styles, but we must avoid passing boolean `fill` to DOM.
    // We also removed other unused Next/Image specific props like sizes, onLoad, priority from MockImageProps or from being spread.

    // The warning "Using `<img>` could result in slower LCP..." is fine for this mock.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} width={width} height={height} {...rest} />;
  },
}));

// Mock ThemeToggleButton
jest.mock('@/components/theme-toggle-button', () => ({
  ThemeToggleButton: () => <button aria-label="Toggle theme">Theme</button>,
}));

// Define a type for SVG icon props
type IconProps = React.SVGProps<SVGSVGElement>;

// Mock lucide-react icons (simplified to avoid requireActual for now)
jest.mock('lucide-react', () => ({
  Download: (props: IconProps) => <svg data-testid="download-icon" {...props} />,
  ChevronDown: (props: IconProps) => <svg data-testid="chevron-down-icon" {...props} />,
  ChevronUp: (props: IconProps) => <svg data-testid="chevron-up-icon" {...props} />,
  Check: (props: IconProps) => <svg data-testid="check-icon" {...props} />,
}));


// Mock localStorage
const mockLocalStorage = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock canvas methods (if generateImage function is called by any interaction)
// Define a more specific type for the mock if possible
type CanvasContextOptions = Record<string, unknown>;
HTMLCanvasElement.prototype.getContext = jest.fn(
    (_contextId: string, _options?: CanvasContextOptions): CanvasRenderingContext2D | null => null
  ) as any; // Use 'as any' to simplify complex overload signature for mocking
HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/jpeg;base64,mocked_image_data');

// Define a more specific type for Album and Artist for the payload
interface MockLastFmImage {
  '#text': string;
  size: string;
}
interface MockArtist {
  name: string;
  mbid: string;
  url: string;
}
// Define a type alias for the image list
type MockLastFmImageList = MockLastFmImage[];

interface MockAlbum { // Updated: spotifyUrl removed
  name: string;
  artist: MockArtist;
  image: MockLastFmImageList;
  mbid: string;
  playcount: number;
  // spotifyUrl: string | null; // Removed
}

// This payload is now only for /api/albums
const mockApiAlbumsPayload: MockAlbum[] = [
  {
    name: 'Album 1',
    artist: { name: 'Artist A', mbid: 'artist-a-mbid', url: 'http://artist.a' },
    image: [
      { '#text': '', size: 'small' },
      { '#text': '', size: 'medium' },
      { '#text': '', size: 'large' },
      { '#text': 'http://example.com/image1.jpg', size: 'extralarge' },
    ],
    mbid: 'album-1-mbid',
    playcount: 100,
  },
  {
    name: 'Album 2',
    artist: { name: 'Artist B', mbid: 'artist-b-mbid', url: 'http://artist.b' },
    image: [
      { '#text': '', size: 'small' },
      { '#text': '', size: 'medium' },
      { '#text': '', size: 'large' },
      { '#text': 'http://example.com/image2.jpg', size: 'extralarge' },
    ],
    mbid: 'album-2-mbid',
    playcount: 90,
  },
  {
    name: 'Album 3 Error',
    artist: { name: 'Artist C', mbid: 'artist-c-mbid', url: 'http://artist.c' },
    image: [
      { '#text': '', size: 'small' },
      { '#text': '', size: 'medium' },
      { '#text': '', size: 'large' },
      { '#text': 'http://example.com/image3.jpg', size: 'extralarge' },
    ],
    mbid: 'album-3-mbid',
    playcount: 80,
  },
];

describe('Home Page - Asynchronous Spotify Integration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockLocalStorage.clear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
    mockLocalStorage.setItem('username', 'testuser');

    // Default fetch mock implementation
    mockFetch.mockImplementation(async (url: RequestInfo | URL): Promise<Partial<Response>> => {
      const urlString = url.toString();
      if (urlString.startsWith('/api/albums')) {
        return {
          ok: true,
          json: async () => ({ topalbums: { album: mockApiAlbumsPayload as MockAlbum[] } }), // Ensure type here
        };
      }
      if (urlString.startsWith('/api/spotify-link')) {
        // Default: Spotify link not found for most, specific overrides below
        return {
          ok: true,
          json: async () => ({ spotifyUrl: null, message: 'Not found by default mock' }),
        };
      }
      // Fallback for any other fetch calls
      return { ok: false, status: 404, json: async () => ({ message: 'Unhandled fetch call' }) };
    });
  });

  it('initially renders albums without Spotify icons', async () => {
    render(<Home />);
    const usernameInput = screen.getByPlaceholderText('LastFM Username') as HTMLInputElement;
    expect(usernameInput.value).toBe('testuser');

    fireEvent.click(screen.getByText('Generate Grid'));

    await screen.findByText('Album 1'); // Wait for albums to render
    expect(screen.getByText('Album 2')).toBeInTheDocument();

    // Check that no Spotify links are present initially
    const spotifyLinks = screen.queryAllByRole('link', { name: 'Play on Spotify' });
    expect(spotifyLinks.length).toBe(0);
  });

  it('fetches and displays Spotify link for an album, and handles not found', async () => {
    // Override fetch mock for specific spotify-link calls
    mockFetch.mockImplementation(async (url: RequestInfo | URL): Promise<Partial<Response>> => {
      const urlString = url.toString();
      const urlParams = new URL(urlString, 'http://localhost').searchParams; // Base URL for parsing

      if (urlString.startsWith('/api/albums')) {
        return {
          ok: true,
          json: async () => ({ topalbums: { album: mockApiAlbumsPayload as MockAlbum[] } }), // Ensure type here
        };
      }
      if (urlString.startsWith('/api/spotify-link')) {
        const albumName = urlParams.get('albumName');
        if (albumName === 'Album 1') {
          return {
            ok: true,
            json: async () => ({ spotifyUrl: 'http://spotify.com/album/1-found' }),
          };
        }
        if (albumName === 'Album 2') { // Explicitly not found
          return {
            ok: true,
            json: async () => ({ spotifyUrl: null, message: 'Not found for Album 2' }),
          };
        }
      }
      return { ok: false, status: 404, json: async () => ({ message: 'Unhandled fetch call' }) };
    });

    render(<Home />);
    fireEvent.click(screen.getByText('Generate Grid'));

    // Wait for Album 1's Spotify link to appear
    const spotifyLinkAlbum1 = await screen.findByRole('link', { name: 'Play on Spotify' });
    expect(spotifyLinkAlbum1).toBeInTheDocument();
    expect(spotifyLinkAlbum1).toHaveAttribute('href', 'http://spotify.com/album/1-found');

    // Ensure Album 1 image has hover effect enabled
    const album1Image = screen.getByAltText('Album 1 by Artist A');
    expect(album1Image.className).toContain('group-hover:opacity-70');

    // For Album 2, ensure the link does NOT appear (even after Album 1's link has loaded)
    // We need to be careful here. waitFor might timeout if it never finds it.
    // Instead, query within Album 2's card after some time or after other elements settle.
    const album2Image = screen.getByAltText('Album 2 by Artist B');
    const album2Card = album2Image.closest('div.group.album-hover-container');
    expect(album2Card).toBeInTheDocument();
    if(album2Card) {
        // Wait a brief moment to ensure async operations for Album 2 might have completed
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        });
        const spotifyLinkAlbum2 = within(album2Card as HTMLElement).queryByRole('link', { name: 'Play on Spotify' });
        expect(spotifyLinkAlbum2).not.toBeInTheDocument();
        expect(album2Image.className).not.toContain('group-hover:opacity-70');
    }
  });

  it('handles error when fetching a Spotify link for an album', async () => {
    mockFetch.mockImplementation(async (url: RequestInfo | URL): Promise<Partial<Response>> => {
      const urlString = url.toString();
      const urlParams = new URL(urlString, 'http://localhost').searchParams;

      if (urlString.startsWith('/api/albums')) {
        return {
          ok: true,
          json: async () => ({ topalbums: { album: mockApiAlbumsPayload as MockAlbum[] } }), // Ensure type here
        };
      }
      if (urlString.startsWith('/api/spotify-link')) {
        const albumName = urlParams.get('albumName');
        if (albumName === 'Album 3 Error') {
          return {
            ok: false, // Simulate server error for this specific album
            status: 500,
            json: async () => ({ message: 'Server error fetching Spotify link' }),
          };
        }
        // Other albums might succeed or not be found
        return { ok: true, json: async () => ({ spotifyUrl: null }) };
      }
      return { ok: false, status: 404, json: async () => ({ message: 'Unhandled fetch call' }) };
    });

    render(<Home />);
    fireEvent.click(screen.getByText('Generate Grid'));

    // Wait for albums to render
    await screen.findByText('Album 3 Error');

    const album3Image = screen.getByAltText('Album 3 Error by Artist C');
    const album3Card = album3Image.closest('div.group.album-hover-container');
    expect(album3Card).toBeInTheDocument();

    if(album3Card) {
        // Wait for async operations
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
        });
        const spotifyLinkAlbum3 = within(album3Card as HTMLElement).queryByRole('link', { name: 'Play on Spotify' });
        expect(spotifyLinkAlbum3).not.toBeInTheDocument();
        expect(album3Image.className).not.toContain('group-hover:opacity-70');
    }
  });
});
