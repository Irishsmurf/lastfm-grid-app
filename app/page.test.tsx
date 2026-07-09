// app/page.test.tsx
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from './page';
import { trackEvent } from '@/lib/analytics';

jest.mock('@/lib/analytics', () => ({
  trackEvent: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({
  getRemoteConfigValue: jest.fn((key: string) => ({
    asString: () => {
      if (key === 'default_time_period') return '1month';
      if (key === 'welcome_message_variant') return 'none';
      if (key === 'welcome_message_text_short') return '';
      if (key === 'welcome_message_text_detailed') return '';
      if (key === 'highlight_initial_action') return 'none';
      if (key === 'example_username_value') return '';
      return '';
    },
    asBoolean: () => false,
    asNumber: () => 0,
  })),
  defaultRemoteConfig: {
    ftue_enabled: false,
    welcome_message_variant: 'none',
    welcome_message_text_short: '',
    welcome_message_text_detailed: '',
    highlight_initial_action: 'none',
    prefill_example_username: false,
    example_username_value: '',
    default_time_period: '1month',
  },
  remoteConfig: null,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    className,
  }: {
    src: string;
    alt: string;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
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
  Loader2: (props: IconProps) => <svg data-testid="loader2-icon" {...props} />,
  LayoutGrid: (props: IconProps) => (
    <svg data-testid="layout-grid-icon" {...props} />
  ),
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

// MinimizedAlbum shape — matches what the /api/albums endpoint returns
interface MockAlbum {
  name: string;
  artist: { name: string; mbid: string };
  imageUrl: string;
  mbid: string;
  playcount: number;
}

const mockApiAlbumsPayload: MockAlbum[] = Array.from({ length: 9 }, (_, i) => ({
  name: `Album ${i + 1}`,
  artist: {
    name: `Artist ${String.fromCharCode(65 + i)}`,
    mbid: `artist-${i}-mbid`,
  },
  imageUrl: `http://example.com/image${i + 1}.jpg`,
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
        screen.getByText(`${album.playcount.toLocaleString()} plays`)
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

    // Grid container remains visible behind the spinner overlay
    expect(screen.queryByTestId('album-grid-container')).toBeInTheDocument();

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
        screen.getByText(`${album.playcount.toLocaleString()} plays`)
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

describe('Home Page - Analytics tracking', () => {
  const mockedTrackEvent = trackEvent as jest.Mock;

  beforeEach(() => {
    mockLocalStorage.clear();
    mockedTrackEvent.mockClear();
  });

  it('tracks generate_grid with username, time_range, and grid_size on success', async () => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (url: RequestInfo | URL) => {
      const urlString = url.toString();
      if (urlString.startsWith('/api/albums')) {
        return {
          ok: true,
          json: async () => ({
            albums: mockApiAlbumsPayload,
            sharedId: 'test-share-id',
          }),
        };
      }
      if (urlString.startsWith('/api/spotify-link')) {
        return { ok: true, json: async () => ({ spotifyUrl: null }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    render(<Home />);

    fireEvent.change(screen.getByPlaceholderText('LastFM Username'), {
      target: { value: 'testuser' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Grid' }));

    await screen.findByTestId('album-grid-container');

    expect(mockedTrackEvent).toHaveBeenCalledWith(
      'generate_grid',
      expect.objectContaining({
        username: 'testuser',
        time_range: '1month',
        grid_size: 9,
      })
    );
    expect(mockedTrackEvent).not.toHaveBeenCalledWith(
      'generate_grid_failed',
      expect.anything()
    );
  });

  it('tracks generate_grid_failed with time_range and error_reason on failure', async () => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (url: RequestInfo | URL) => {
      const urlString = url.toString();
      if (urlString.startsWith('/api/albums')) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ message: 'Last.fm user not found' }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    render(<Home />);

    fireEvent.change(screen.getByPlaceholderText('LastFM Username'), {
      target: { value: 'testuser' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Grid' }));

    await screen.findByText('Last.fm user not found');

    expect(mockedTrackEvent).toHaveBeenCalledWith(
      'generate_grid_failed',
      expect.objectContaining({
        time_range: '1month',
        error_reason: 'Last.fm user not found',
      })
    );
    expect(mockedTrackEvent).not.toHaveBeenCalledWith(
      'generate_grid',
      expect.anything()
    );
  });

  it('tracks share_grid with username and shared_id when Share button is clicked', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    mockFetch.mockReset();
    mockFetch.mockImplementation(async (url: RequestInfo | URL) => {
      const urlString = url.toString();
      if (urlString.startsWith('/api/albums')) {
        return {
          ok: true,
          json: async () => ({
            albums: mockApiAlbumsPayload,
            sharedId: 'test-share-id',
          }),
        };
      }
      if (urlString.startsWith('/api/spotify-link')) {
        return { ok: true, json: async () => ({ spotifyUrl: null }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    render(<Home />);

    fireEvent.change(screen.getByPlaceholderText('LastFM Username'), {
      target: { value: 'testuser' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Grid' }));

    await screen.findByTestId('album-grid-container');

    fireEvent.click(screen.getByRole('button', { name: /Share Grid/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());

    expect(mockedTrackEvent).toHaveBeenCalledWith(
      'share_grid',
      expect.objectContaining({
        username: 'testuser',
        shared_id: 'test-share-id',
      })
    );
  });

  it('tracks view_toggle with direction "to_jpg" when the Grid⇄JPG toggle is clicked', async () => {
    // The default canvas mocks at the top of this file return a null 2D
    // context, which is fine for tests that never render a JPG. Converting
    // to JPG here requires generateImage() to actually succeed, so we swap in
    // a fake context covering everything generateImage/logo colour analysis
    // touch — same pattern as the "JPG label toggle cache invalidation" suite.
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const srcDescriptor = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      'src'
    );

    const fakeCtx = {
      fillStyle: '',
      font: '',
      textAlign: '',
      imageSmoothingEnabled: false,
      imageSmoothingQuality: '',
      fillRect: jest.fn(),
      drawImage: jest.fn(),
      fillText: jest.fn(),
      measureText: jest.fn(() => ({ width: 10 })),
      getImageData: jest.fn(() => ({
        data: new Uint8ClampedArray(64 * 64 * 4),
      })),
    };
    HTMLCanvasElement.prototype.getContext = jest.fn(
      () => fakeCtx
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = jest.fn(
      () => 'data:image/jpeg;base64,gen-1'
    );
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      get() {
        return this._src ?? '';
      },
      set(value: string) {
        this._src = value;
        if (typeof this.onload === 'function') {
          Promise.resolve().then(() => this.onload(new Event('load')));
        }
      },
    });

    try {
      mockFetch.mockReset();
      mockFetch.mockImplementation(async (url: RequestInfo | URL) => {
        const urlString = url.toString();
        if (urlString.startsWith('/api/albums')) {
          return {
            ok: true,
            json: async () => ({
              albums: mockApiAlbumsPayload,
              sharedId: 'test-share-id',
            }),
          };
        }
        if (urlString.startsWith('/api/spotify-link')) {
          return { ok: true, json: async () => ({ spotifyUrl: null }) };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });

      render(<Home />);

      fireEvent.change(screen.getByPlaceholderText('LastFM Username'), {
        target: { value: 'testuser' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Generate Grid' }));

      await screen.findByTestId('album-grid-container');

      fireEvent.click(screen.getByRole('button', { name: /Convert to JPG/ }));
      await screen.findByAltText('Album Grid JPG');

      expect(mockedTrackEvent).toHaveBeenCalledWith('view_toggle', {
        direction: 'to_jpg',
      });

      const revertButton = await screen.findByRole('button', {
        name: /Revert to Grid/,
      });
      await waitFor(() => expect(revertButton).not.toBeDisabled());
      fireEvent.click(revertButton);
      await screen.findByTestId('album-grid-container');

      expect(mockedTrackEvent).toHaveBeenCalledWith('view_toggle', {
        direction: 'to_grid',
      });
    } finally {
      if (srcDescriptor) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', srcDescriptor);
      }
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
    }
  });
});

describe('Home Page - JPG label toggle cache invalidation', () => {
  // Each generateImage() call produces a unique data URL so we can assert which
  // generation is actually being displayed.
  let toDataUrlCounter: number;
  let srcDescriptor: PropertyDescriptor | undefined;
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
  let originalToDataURL: typeof HTMLCanvasElement.prototype.toDataURL;

  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.setItem('username', 'testuser');

    mockFetch.mockReset();
    mockFetch.mockImplementation(async (url: RequestInfo | URL) => {
      const urlString = url.toString();
      if (urlString.startsWith('/api/albums')) {
        return {
          ok: true,
          json: async () => ({
            albums: mockApiAlbumsPayload,
            sharedId: 'test-share-id',
          }),
        };
      }
      if (urlString.startsWith('/api/spotify-link')) {
        return { ok: true, json: async () => ({ spotifyUrl: null }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    // Fake 2D canvas context covering every method generateImage and the logo
    // colour analysis rely on.
    toDataUrlCounter = 0;
    const fakeCtx = {
      fillStyle: '',
      font: '',
      textAlign: '',
      imageSmoothingEnabled: false,
      imageSmoothingQuality: '',
      fillRect: jest.fn(),
      drawImage: jest.fn(),
      fillText: jest.fn(),
      measureText: jest.fn(() => ({ width: 10 })),
      getImageData: jest.fn(() => ({
        data: new Uint8ClampedArray(64 * 64 * 4),
      })),
    };
    // Capture the originals so they can be restored in afterEach, avoiding
    // pollution of the other suites in this file (which rely on getContext
    // returning null).
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.getContext = jest.fn(
      () => fakeCtx
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = jest.fn(
      () => `data:image/jpeg;base64,gen-${++toDataUrlCounter}`
    );

    // Make <img> elements created via document.createElement / new Image()
    // resolve their onload as soon as a src is assigned, so the async image
    // loading inside generateImage completes.
    srcDescriptor = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      'src'
    );
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      get() {
        return this._src ?? '';
      },
      set(value: string) {
        this._src = value;
        if (typeof this.onload === 'function') {
          Promise.resolve().then(() => this.onload(new Event('load')));
        }
      },
    });
  });

  afterEach(() => {
    if (srcDescriptor) {
      Object.defineProperty(HTMLImageElement.prototype, 'src', srcDescriptor);
    }
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
  });

  async function loadGrid() {
    fireEvent.click(screen.getByRole('button', { name: 'Generate Grid' }));
    await screen.findByTestId('album-grid-container');
  }

  async function convertToJpg() {
    fireEvent.click(screen.getByRole('button', { name: /Convert to JPG/ }));
    await screen.findByAltText('Album Grid JPG');
  }

  it('regenerates the JPG instead of showing a stale grid after a new fetch', async () => {
    render(<Home />);

    // 1. Generate a grid, 2. Convert to JPG (labels off → withoutLabels = gen-1)
    await loadGrid();
    await convertToJpg();
    expect(screen.getByAltText('Album Grid JPG')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,gen-1'
    );

    // 3. Turn labels on → withLabels = gen-2
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Labels Off' }));
    });
    await screen.findByRole('button', { name: 'Labels On' });
    expect(screen.getByAltText('Album Grid JPG')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,gen-2'
    );

    // 4. Generate a new grid without refreshing — this must invalidate the
    //    cached JPGs from the previous grid.
    await loadGrid();

    // 5. Convert to JPG again (labels preference still on → withLabels = gen-3)
    await convertToJpg();
    expect(screen.getByAltText('Album Grid JPG')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,gen-3'
    );

    // 6. Flip labels off. The withoutLabels slot was cleared by the new fetch,
    //    so this must regenerate (gen-4) rather than resurfacing the stale
    //    gen-1 image from the first grid.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Labels On' }));
    });
    await screen.findByRole('button', { name: 'Labels Off' });
    expect(screen.getByAltText('Album Grid JPG')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,gen-4'
    );
  });
});
