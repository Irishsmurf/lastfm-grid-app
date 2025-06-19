import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SharedGridPage from './page'; // Adjust path as necessary
import { SharedGridData } from '@/lib/types'; // Adjust path
import { useParams } from 'next/navigation'; // Re-added import for mocked version

// Mock next/navigation
// jest.mock('next/navigation', () => ({
//   useParams: jest.fn(),
//   useRouter: jest.fn(() => ({ push: jest.fn() })), // Mock useRouter if used for navigation
//   usePathname: jest.fn(),
//   useSearchParams: jest.fn(() => new URLSearchParams()),
// }));
jest.mock('next/navigation');

// Mock global fetch
const mockFetch = jest.spyOn(global, 'fetch');

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('SharedGridPage', () => {
  const mockId = 'test-share-id';

  beforeEach(() => {
    jest.clearAllMocks();
    // useParams is imported and then asserted as jest.Mock for setup
    (useParams as jest.Mock).mockReturnValue({ id: mockId });
  });

  it('should call fetch with the correct URL and display loading state initially', () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => {})); // Keep fetch pending for loading state

    render(<SharedGridPage />);

    expect(screen.getByText('Loading shared grid...')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith(`/api/share/${mockId}`);
  });

  it('should display shared grid data when fetch is successful', async () => {
    const mockSharedData: SharedGridData = {
      id: mockId,
      username: 'testuser',
      period: '7day',
      albums: [
        { name: 'Album 1', artist: 'Artist A', image: 'img1.jpg' },
        { name: 'Album 2', artist: 'Artist B', image: 'img2.jpg' },
      ],
      createdAt: new Date().toISOString(),
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSharedData,
    } as Response);

    // Mock fetch for spotify links (called due to albums being present)
    mockFetch.mockResolvedValue({
      // Default for subsequent spotify calls
      ok: true,
      json: async () => ({ spotifyUrl: null }),
    } as Response);

    render(<SharedGridPage />);

    // Wait for loading to disappear and data to appear
    await waitFor(() =>
      expect(
        screen.queryByText('Loading shared grid...')
      ).not.toBeInTheDocument()
    );

    expect(
      screen.getByText(`Album Grid by ${mockSharedData.username}`)
    ).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes(`Period: ${mockSharedData.period}`)
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Album 1')).toBeInTheDocument();
    expect(screen.getByText('Artist A')).toBeInTheDocument();
    expect(screen.getByText('Album 2')).toBeInTheDocument();
    expect(screen.getByText('Artist B')).toBeInTheDocument();
  });

  it('should display "Shared grid not found" error when fetch returns 404', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Shared grid not found' }),
    } as Response);

    render(<SharedGridPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Error: Shared grid not found')
      ).toBeInTheDocument();
    });
  });

  it('should display generic error message when fetch fails with other errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal Server Error' }),
    } as Response);

    render(<SharedGridPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Error: Internal Server Error')
      ).toBeInTheDocument();
    });
  });

  it('should display generic error message when fetch promise is rejected', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    render(<SharedGridPage />);

    await waitFor(() => {
      expect(screen.getByText('Error: Network failure')).toBeInTheDocument();
    });
  });

  // Test for Spotify link fetching (basic call verification)
  it('should attempt to fetch Spotify links if shared data has albums', async () => {
    const mockAlbums = [
      { name: 'Album X', artist: 'Artist X', image: 'imgX.jpg' },
    ];
    const mockSharedDataWithAlbums: SharedGridData = {
      id: mockId,
      username: 'spotifyUser',
      period: '1month',
      albums: mockAlbums,
      createdAt: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      // For initial /api/share/[id]
      ok: true,
      json: async () => mockSharedDataWithAlbums,
    } as Response);

    // For /api/spotify-link
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ spotifyUrl: 'spotify.com/albumX' }),
    } as Response);

    render(<SharedGridPage />);

    await waitFor(() => {
      expect(screen.getByText('Album X')).toBeInTheDocument();
    });

    // Verify fetch was called for Spotify link
    // The first call is for sharedData, the second for the spotify link for 'Album X'
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/spotify-link?artistName=${encodeURIComponent('Artist X')}&albumName=${encodeURIComponent('Album X')}`
    );
  });
});
