// app/share/[id]/page.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SharedCollectionPage from './page'; // Adjust path if needed

// Mock Next.js navigation (useParams)
jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  // useRouter: jest.fn(), // if you use router
}));

// Mock global.fetch for the API call to /api/shared-collection/[id]
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      title: 'Mocked Collection Title',
      username: 'MockUser',
      timeRange: '7day',
      description: 'Mock description',
      albums: Array(9).fill(null).map((_, i) => ({
        name: `Album ${i + 1}`,
        artist: { name: `Artist ${i + 1}`, mbid: `mbid-artist-${i}`, url: '#' },
        image: [{}, {}, {}, { size: 'extralarge', '#text': '/api/placeholder/300/300' }],
        mbid: `mbid-album-${i}`,
        playcount: 10
      })),
      createdAt: new Date().toISOString(),
    }),
  })
) as jest.Mock;

describe('SharedCollectionPage', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
    // Ensure that the mock implementation for useParams is reset or set before each test.
    (jest.requireMock('next/navigation').useParams as jest.Mock).mockReturnValue({ id: 'test-collection-id' });
  });

  it('should render loading state initially', () => {
    render(<SharedCollectionPage />);
    expect(screen.getByText('Loading collection...')).toBeInTheDocument();
  });

  it('should render collection data after successful fetch', async () => {
    render(<SharedCollectionPage />);
    await waitFor(() => {
      expect(screen.getByText('Mocked Collection Title')).toBeInTheDocument();
    });
    expect(screen.getByText('Shared by: MockUser')).toBeInTheDocument();
    // This depends on the timeRanges object in the component.
    // If '7day' maps to 'Last Week', this is correct.
    expect(screen.getByText(/Time Frame: Last Week/i)).toBeInTheDocument();
    expect(screen.getByText('Mock description')).toBeInTheDocument();
    // Check for one of the album names
    expect(screen.getByText('Album 1')).toBeInTheDocument();
  });

  it('should render error state if fetch fails', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        statusText: 'API Error',
        json: () => Promise.resolve({ message: 'Failed to fetch from server' }) // Simulate error structure from API
      })
    );
    render(<SharedCollectionPage />);
    await waitFor(() => {
      // The error message might include the specific message from the API
      expect(screen.getByText(/Failed to load shared collection. Failed to fetch from server/i)).toBeInTheDocument();
    });
  });

  it('should render "No collection ID provided." if ID is missing', async () => {
     (jest.requireMock('next/navigation').useParams as jest.Mock).mockReturnValue({ id: '' });
     render(<SharedCollectionPage />);
     // No need for waitFor if the error is set synchronously based on lack of ID
     expect(screen.getByText('No collection ID provided.')).toBeInTheDocument();
  });

  // Add more tests:
  // - Spotify links integration (if possible to test this level of detail)
  // - Image rendering (existence of Image components)
  // - Date formatting for 'Shared on'
});
