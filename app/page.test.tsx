// app/page.test.tsx
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  act,
  // waitFor, // Removed unused import
} from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from './page';
import { ImageProps } from 'next/image';

// Mock Next.js Image component
interface MockImageProps extends Omit<ImageProps, 'src'> {
  src: string;
  alt: string;
  width?: number | `${number}` | undefined;
  height?: number | `${number}` | undefined;
  className?: string;
  fill?: boolean;
  sizes?: string;
  onLoad?: () => void;
}

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: MockImageProps) => {
    const { src, alt, width, height, className } = props;
    return (
      // Removed unused eslint-disable-next-line comment
      <img
        src={src as string}
        alt={alt}
        width={width as number}
        height={height as number}
        className={className}
      />
    );
  },
}));

// Mock ThemeToggleButton
jest.mock('@/components/theme-toggle-button', () => ({
  ThemeToggleButton: () => <button aria-label="Toggle theme">Theme</button>,
}));

type IconProps = React.SVGProps<SVGSVGElement>;
jest.mock('lucide-react', () => ({
  Download: (props: IconProps) => (
    <svg data-testid="download-icon" {...props} />
  ),
  ChevronDown: (props: IconProps) => (
    <svg data-testid="chevron-down-icon" {...props} />
  ),
  ChevronUp: (props: IconProps) => (
    <svg data-testid="chevron-up-icon" {...props} />
  ),
  Check: (props: IconProps) => <svg data-testid="check-icon" {...props} />,
  FileImage: (props: IconProps) => (
    <svg data-testid="file-image-icon" {...props} />
  ),
  Share2: (props: IconProps) => <svg data-testid="share2-icon" {...props} />,
}));

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

const mockFetch = jest.fn();
global.fetch = mockFetch;

HTMLCanvasElement.prototype.getContext = jest.fn(() => null) as any;
HTMLCanvasElement.prototype.toDataURL = jest.fn(
  () => 'data:image/jpeg;base64,mocked_image_data'
);

interface MockLastFmImage {
  '#text': string;
  size: string;
}
interface MockArtist {
  name: string;
  mbid: string;
  url: string;
}
type MockLastFmImageList = MockLastFmImage[];
interface MockAlbum {
  name: string;
  artist: MockArtist;
  image: MockLastFmImageList;
  mbid: string;
  playcount: number;
}

const mockApiAlbumsPayload: MockAlbum[] = Array.from({ length: 9 }, (_, i) => ({
  name: `Album ${i + 1}`,
  artist: {
    name: `Artist ${String.fromCharCode(65 + i)}`,
    mbid: `artist-${i}-mbid`,
    url: `http://artist.${i}`,
  },
  image: [
    { '#text': '', size: 'small' },
    { '#text': '', size: 'medium' },
    { '#text': '', size: 'large' },
    { '#text': `http://example.com/image${i + 1}.jpg`, size: 'extralarge' },
  ],
  mbid: `album-${i + 1}-mbid`,
  playcount: 100 - i * 10,
}));

describe('Home Page - Grid Update Animations and Loading Spinner', () => {
  // Variables to control mock fetch resolution
  let resolveAlbumsFetch: (value: Partial<Response>) => void;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let rejectAlbumsFetch: (reason?: any) => void; // If testing fetch errors

  beforeEach(() => {
    mockFetch.mockClear();
    mockLocalStorage.clear();
    mockLocalStorage.setItem('username', 'testuser');

    mockFetch.mockImplementation(
      async (url: RequestInfo | URL): Promise<Partial<Response>> => {
        const urlString = url.toString();
        if (urlString.startsWith('/api/albums')) {
          return new Promise((resolve, reject) => {
            resolveAlbumsFetch = resolve;
            rejectAlbumsFetch = reject; // Store reject function if needed for error testing
          });
        }
        if (urlString.startsWith('/api/spotify-link')) {
          // Spotify links are fetched after albums load, keep this immediate for simplicity unless testing its loading states
          return { ok: true, json: async () => ({ spotifyUrl: null }) };
        }
        return {
          ok: false,
          status: 404,
          json: async () => ({ message: 'Unhandled fetch call' }),
        };
      }
    );

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers(); // Ensure all timers are run
    jest.useRealTimers();
  });

  test('full grid update cycle: initial load, fade-out, spinner, new grid fade-in', async () => {
    render(<Home />);

    fireEvent.change(screen.getByPlaceholderText('LastFM Username'), {
      target: { value: 'testuser' },
    });
    const generateButton = screen.getByRole('button', {
      name: 'Generate Grid',
    });

    // === Initial Load ===
    fireEvent.click(generateButton);

    // Button becomes "Loading..." (indicates isGridUpdating=true, loading=true)
    expect(
      await screen.findByRole('button', { name: 'Loading...' })
    ).toBeDisabled();

    // Spinner appears after 500ms
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('loading-spinner')).toBeVisible();
    // At this moment, no grid container should be visible as albums haven't loaded
    expect(
      screen.queryByTestId('album-grid-container')
    ).not.toBeInTheDocument();

    // Resolve the albums fetch
    await act(async () => {
      resolveAlbumsFetch({
        ok: true,
        json: async () => ({
          albums: mockApiAlbumsPayload,
          sharedId: 'test-share-id',
        }),
      });
      // Wait for all microtasks and state updates to process
      // This sequence helps ensure React processes state updates triggered by promises
      await Promise.resolve(); // fetch resolves
      await Promise.resolve(); // setAlbums, setIsGridUpdating(false)
      await Promise.resolve(); // useEffect for showSpinner(false)
    });

    // Advance timers for the individual image fade-in useEffect (20ms)
    act(() => {
      jest.advanceTimersByTime(20);
    });

    // Spinner should be gone
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();

    // Grid items should be present and have fade-in class
    const gridContainer = screen.getByTestId('album-grid-container');
    expect(gridContainer).toBeVisible();
    expect(gridContainer).not.toHaveClass('grid-fade-out-active');

    const initialAlbumImages = await screen.findAllByRole('img', {
      name: /Album \d+ by Artist [A-Z]/,
    });
    expect(initialAlbumImages.length).toBe(mockApiAlbumsPayload.length);
    initialAlbumImages.forEach((img) => {
      expect(img.className).toContain('image-fade-enter-active');
    });

    // Verify playcounts are displayed for initial load
    mockApiAlbumsPayload.forEach((album) => {
      expect(
        screen.getByText(`${album.playcount} listens`)
      ).toBeInTheDocument();
    });

    // === Subsequent Update (Click "Generate Grid" again) ===
    const generateButtonAgain = screen.getByRole('button', {
      name: 'Generate Grid',
    });
    fireEvent.click(generateButtonAgain);

    // Button becomes "Loading..."
    expect(
      await screen.findByRole('button', { name: 'Loading...' })
    ).toBeDisabled();

    // Grid container should now have the fade-out class (it has existing content)
    // It should still be in the DOM because showSpinner is false initially in this cycle
    expect(gridContainer).toHaveClass('grid-fade-out-active');

    // Spinner appears after 500ms
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('loading-spinner')).toBeVisible();

    // Now the grid container with its items should be unmounted due to `!showSpinner` condition
    expect(
      screen.queryByTestId('album-grid-container')
    ).not.toBeInTheDocument();

    // Resolve the second albums fetch
    await act(async () => {
      resolveAlbumsFetch({
        ok: true,
        json: async () => ({
          albums: mockApiAlbumsPayload,
          sharedId: 'test-share-id',
        }), // can use different payload if needed
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(20);
    });

    // Spinner should be gone
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();

    // New grid container should be back and visible
    const newGridContainer = screen.getByTestId('album-grid-container');
    expect(newGridContainer).toBeVisible();
    expect(newGridContainer).not.toHaveClass('grid-fade-out-active');

    const newAlbumImages = await screen.findAllByRole('img', {
      name: /Album \d+ by Artist [A-Z]/,
    });
    expect(newAlbumImages.length).toBe(mockApiAlbumsPayload.length);
    newAlbumImages.forEach((img) => {
      expect(img.className).toContain('image-fade-enter-active');
    });

    // Verify playcounts are displayed for subsequent update
    mockApiAlbumsPayload.forEach((album) => {
      expect(
        screen.getByText(`${album.playcount} listens`)
      ).toBeInTheDocument();
    });
  });
});

describe('Home Page - Basic Rendering', () => {
  beforeEach(() => {
    // Minimal setup for basic rendering, localStorage might not be needed for all basic tests
    mockLocalStorage.clear();
    mockFetch.mockImplementation(async () => ({
      ok: false,
      json: async () => ({}),
    })); // Default to avoid unhandled fetch
  });

  it('renders username input and generate button', () => {
    render(<Home />);
    expect(screen.getByPlaceholderText('LastFM Username')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Generate Grid' })
    ).toBeInTheDocument();
  });
});
