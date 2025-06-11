// app/page.test.tsx
import React from 'react'; // Still good practice to have it for tests, though react-jsx might not strictly need it.
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'; // Added within
import '@testing-library/jest-dom';
import Home from './page';

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    const { src, alt, width, height, fill, className, sizes, onLoad, priority, ...rest } = props;
    // Simplified mock: just render an img tag with src and alt
    // Include other common props to avoid warnings if they are passed
    return <img src={src} alt={alt} className={className} width={width} height={height} {...rest} />;
  },
}));

// Mock ThemeToggleButton
jest.mock('@/components/theme-toggle-button', () => ({
  ThemeToggleButton: () => <button aria-label="Toggle theme">Theme</button>,
}));

// Mock lucide-react icons (simplified to avoid requireActual for now)
jest.mock('lucide-react', () => ({
  Download: (props: any) => <svg data-testid="download-icon" {...props} />,
  ChevronDown: (props: any) => <svg data-testid="chevron-down-icon" {...props} />,
  ChevronUp: (props: any) => <svg data-testid="chevron-up-icon" {...props} />,
  Check: (props: any) => <svg data-testid="check-icon" {...props} />,
  // Add any other icons imported by the component under test as needed
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
HTMLCanvasElement.prototype.getContext = jest.fn(() => null) as any;
HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/jpeg;base64,mocked_image_data');


const mockAlbumsPayload = [
  {
    name: 'Album with Spotify',
    artist: { name: 'Artist A', mbid: 'artist-a-mbid', url: 'http://artist.a' },
    image: [{}, {}, {}, { '#text': 'http://example.com/image1.jpg' }],
    mbid: 'album-1-mbid',
    playcount: 100,
    spotifyUrl: 'http://spotify.com/album/1',
  },
  {
    name: 'Album without Spotify',
    artist: { name: 'Artist B', mbid: 'artist-b-mbid', url: 'http://artist.b' },
    image: [{}, {}, {}, { '#text': 'http://example.com/image2.jpg' }],
    mbid: 'album-2-mbid',
    playcount: 90,
    spotifyUrl: null,
  },
];

describe('Home Page - Spotify Integration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Clear all localStorage mocks and reset the store for each test
    mockLocalStorage.clear(); // This clears the 'store' object
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();

    // Set a default username in localStorage for tests that need it
    // No need to wrap this specific setItem in act() as it's synchronous and part of setup
    mockLocalStorage.setItem('username', 'testuser');
  });

  const setupFetchMockSuccess = (albumsData: any[]) => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ topalbums: { album: albumsData } }),
    });
  };

  it('displays Spotify icon on hover and links correctly when spotifyUrl is present', async () => {
    setupFetchMockSuccess(mockAlbumsPayload);

    render(<Home />);

    // Username input should be pre-filled from localStorage mock
    const usernameInput = screen.getByPlaceholderText('LastFM Username') as HTMLInputElement;
    expect(usernameInput.value).toBe('testuser'); // Verify it's pre-filled

    const generateButton = screen.getByText('Generate Grid');
    // Use act for fetch and subsequent state updates
    await act(async () => {
        fireEvent.click(generateButton);
    });

    // Wait for the first album to appear by its name
    const album1Name = await screen.findByText('Album with Spotify');
    expect(album1Name).toBeInTheDocument();

    // Find the image associated with "Album with Spotify" to get its container
    const albumImage = screen.getByAltText('Album with Spotify by Artist A');
    // The hover container is the parent div with class "group" and "album-hover-container"
    const hoverContainer = albumImage.closest('div.group.album-hover-container');
    expect(hoverContainer).toBeInTheDocument();

    if (hoverContainer) {
      // Simulate mouse enter on the hover container
      fireEvent.mouseEnter(hoverContainer);

      // Check for Spotify icon link. It should become visible on hover.
      // The link is identified by its aria-label or role, if specific enough, or test-id.
      // In page.tsx, the link has alt text "Play on Spotify" via its Image child.
      const spotifyLink = await waitFor(() => screen.getByRole('link', { name: 'Play on Spotify' }));
      expect(spotifyLink).toBeInTheDocument();
      expect(spotifyLink).toHaveAttribute('href', 'http://spotify.com/album/1');
      expect(spotifyLink).toHaveAttribute('target', '_blank');

      // Tailwind's group-hover:opacity-100 makes it visible.
      // Direct opacity check is hard in JSDOM. Check for classes that imply visibility on hover.
      expect(spotifyLink).toHaveClass('opacity-0', 'group-hover:opacity-100');

      // Check for dimming effect on the main album image
      // The class string includes 'group-hover:opacity-70' when spotifyUrl is present
      expect(albumImage).toHaveClass('group-hover:opacity-70');
    }
  });

  it('does not display Spotify icon or dim on hover when spotifyUrl is not present', async () => {
    setupFetchMockSuccess(mockAlbumsPayload);
    render(<Home />);

    const usernameInput = screen.getByPlaceholderText('LastFM Username') as HTMLInputElement;
    expect(usernameInput.value).toBe('testuser'); // Verify pre-fill

    const generateButton = screen.getByText('Generate Grid');
    await act(async () => {
        fireEvent.click(generateButton);
    });

    // Wait for the second album to appear
    const album2Name = await screen.findByText('Album without Spotify');
    expect(album2Name).toBeInTheDocument();

    const albumImage = screen.getByAltText('Album without Spotify by Artist B');
    const hoverContainer = albumImage.closest('div.group.album-hover-container');
    expect(hoverContainer).toBeInTheDocument();

    if (hoverContainer) { // Check if hoverContainer is not null
      fireEvent.mouseEnter(hoverContainer);

      // Use `within` to query inside the specific album's container
      // Assert hoverContainer is HTMLElement for `within`
      const spotifyLink = within(hoverContainer as HTMLElement).queryByRole('link', { name: 'Play on Spotify' });
      expect(spotifyLink).not.toBeInTheDocument();

      // Image should not have the specific hover-dimming class part
      // The conditional class ` ${album.spotifyUrl ? 'group-hover:opacity-70' : ''}` results in an empty string.
      expect(albumImage.className).not.toContain('group-hover:opacity-70');
    }
  });
});
