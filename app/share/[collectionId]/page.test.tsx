import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SharedCollectionPage from './page'; // Adjust path as necessary

// Mock fetch used by fetchSharedCollection
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock the SpotifyLinkButton component as its functionality is tested separately
jest.mock('../../../components/spotify-link-button', () => {
  return jest.fn(({ albumName, artistName }) => (
    <button>Mocked Spotify Link for {albumName} by {artistName}</button>
  ));
});

// Mock process.env.NEXT_PUBLIC_APP_URL
const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  };
});
afterAll(() => {
  process.env = originalEnv;
});


describe('SharedCollectionPage', () => {
  const mockCollectionId = 'test-collection-123';
  const mockCollectionData = {
    id: mockCollectionId,
    username: 'testuser',
    period: '7day',
    title: 'My Awesome Mix',
    description: 'A collection of great songs.',
    albumsData: [
      {
        name: 'Album One',
        artist: { name: 'Artist X' },
        image: [{ '#text': 'url1_small', size: 'small' }, { '#text': 'url1_large', size: 'large' }],
        mbid: 'mbid1',
        url: 'url_album1'
      },
      {
        name: 'Album Two',
        artist: { name: 'Artist Y' },
        image: [{ '#text': 'url2_extralarge', size: 'extralarge' }],
        mbid: 'mbid2',
        url: 'url_album2'
      },
    ],
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders collection data successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCollectionData,
    });

    render(await SharedCollectionPage({ params: { collectionId: mockCollectionId } }));

    // Wait for async operations in Server Component to complete
    // await waitFor(() => { // Not strictly needed if all data is passed after await in component
      expect(screen.getByText(mockCollectionData.title)).toBeInTheDocument();
    // });

    expect(screen.getByText(mockCollectionData.description)).toBeInTheDocument();
    expect(screen.getByText(`Shared by: ${mockCollectionData.username} | Period: ${mockCollectionData.period}`)).toBeInTheDocument(); // Check combined text
    expect(screen.getByText(mockCollectionData.albumsData[0].name)).toBeInTheDocument();
    expect(screen.getByText(mockCollectionData.albumsData[0].artist.name)).toBeInTheDocument();
    expect(screen.getByText(mockCollectionData.albumsData[1].name)).toBeInTheDocument();
    expect(screen.getByText(mockCollectionData.albumsData[1].artist.name)).toBeInTheDocument();

    // Check images (use alt text)
    expect(screen.getByAltText(`Cover art for ${mockCollectionData.albumsData[0].name} by ${mockCollectionData.albumsData[0].artist.name}`)).toHaveAttribute('src', 'url1_large');
    expect(screen.getByAltText(`Cover art for ${mockCollectionData.albumsData[1].name} by ${mockCollectionData.albumsData[1].artist.name}`)).toHaveAttribute('src', 'url2_extralarge');


    // Check that SpotifyLinkButton mock is rendered for each album
    expect(screen.getByText(`Mocked Spotify Link for ${mockCollectionData.albumsData[0].name} by ${mockCollectionData.albumsData[0].artist.name}`)).toBeInTheDocument();
    expect(screen.getByText(`Mocked Spotify Link for ${mockCollectionData.albumsData[1].name} by ${mockCollectionData.albumsData[1].artist.name}`)).toBeInTheDocument();

    expect(mockFetch).toHaveBeenCalledWith(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/share/${mockCollectionId}`,
      { cache: 'no-store' }
    );
  });

  test('renders "Collection Not Found" if fetch returns 404', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not Found' }) // Mock API error response for 404
    });

    render(await SharedCollectionPage({ params: { collectionId: 'not-found-id' } }));

    // await waitFor(() => {
      expect(screen.getByText('Collection Not Found')).toBeInTheDocument();
    // });
    expect(screen.getByText('The shared collection you are looking for does not exist or could not be loaded.')).toBeInTheDocument();
  });

  test('renders "Collection Not Found" if fetch fails (e.g. network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(await SharedCollectionPage({ params: { collectionId: 'network-error-id' } }));

    // await waitFor(() => {
      expect(screen.getByText('Collection Not Found')).toBeInTheDocument();
    // });
  });

   test('renders "Collection Not Found" if fetch returns non-404 error (e.g. 500)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error", // fetchSharedCollection logs this
      json: async () => ({ error: 'Server Error' })
    });

    render(await SharedCollectionPage({ params: { collectionId: 'server-error-id' } }));

    // await waitFor(() => {
      expect(screen.getByText('Collection Not Found')).toBeInTheDocument();
    // });
  });

  test('handles albumsData being null or empty gracefully', async () => {
    const noAlbumsData = { ...mockCollectionData, albumsData: [] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => noAlbumsData,
    });

    render(await SharedCollectionPage({ params: { collectionId: mockCollectionId } }));

    // await waitFor(() => {
      expect(screen.getByText(noAlbumsData.title)).toBeInTheDocument();
    // });
    expect(screen.getByText('No albums found in this collection.')).toBeInTheDocument();
  });

  test('image fallback logic in getImageUrl - picks best available', async () => {
    const albumWithSpecificImages = {
      ...mockCollectionData,
      albumsData: [
        { name: 'Album Large', artist: { name: 'Artist L' }, image: [{ '#text': 'large.jpg', size: 'large' }], mbid:'l', url:'l'},
        { name: 'Album ExtraLarge', artist: { name: 'Artist XL' }, image: [{ '#text': 'extralarge.jpg', size: 'extralarge' }], mbid:'xl', url:'xl'},
        { name: 'Album Medium', artist: { name: 'Artist M' }, image: [{ '#text': 'medium.jpg', size: 'medium' }], mbid:'m', url:'m'},
        { name: 'Album Small', artist: { name: 'Artist S' }, image: [{ '#text': 'small.jpg', size: 'small' }], mbid:'s', url:'s'},
        { name: 'Album Only Mega', artist: { name: 'Artist Mega' }, image: [{ '#text': 'mega.jpg', size: 'mega' }], mbid:'mega', url:'mega'},
        { name: 'Album No Standard', artist: { name: 'Artist Weird' }, image: [{ '#text': 'weird.jpg', size: 'weird_size' as any }], mbid:'weird', url:'weird'},
      ]
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => albumWithSpecificImages,
    });

    render(await SharedCollectionPage({ params: { collectionId: mockCollectionId } }));

    // await waitFor(() => { // Ensure component has processed data
      expect(screen.getByAltText('Cover art for Album Large by Artist L')).toHaveAttribute('src', 'large.jpg');
    // });
    expect(screen.getByAltText('Cover art for Album ExtraLarge by Artist XL')).toHaveAttribute('src', 'extralarge.jpg');
    expect(screen.getByAltText('Cover art for Album Medium by Artist M')).toHaveAttribute('src', 'medium.jpg');
    // Small is not preferred, so it would pick 'medium' if available, or the actual small if it's the only one.
    // The helper prefers large, extralarge, then medium. If only small exists, it will be picked by the "anyImage" fallback.
    expect(screen.getByAltText('Cover art for Album Small by Artist S')).toHaveAttribute('src', 'small.jpg');
    expect(screen.getByAltText('Cover art for Album Only Mega by Artist Mega')).toHaveAttribute('src', 'mega.jpg');
    expect(screen.getByAltText('Cover art for Album No Standard by Artist Weird')).toHaveAttribute('src', 'weird.jpg');
  });

   test('image fallback to placeholder if image array is empty or no #text', async () => {
    const albumWithBadImages = {
      ...mockCollectionData,
      albumsData: [
        { name: 'Album Empty Image', artist: { name: 'Artist EI' }, image: [], mbid:'ei', url:'ei'},
        { name: 'Album No Text', artist: { name: 'Artist NT' }, image: [{ '#text': '', size: 'large' }], mbid:'nt', url:'nt'},
      ]
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => albumWithBadImages,
    });

    render(await SharedCollectionPage({ params: { collectionId: mockCollectionId } }));

    // await waitFor(() => {
      expect(screen.getByAltText('Cover art for Album Empty Image by Artist EI')).toHaveAttribute('src', '/placeholder-image.png');
    // });
    expect(screen.getByAltText('Cover art for Album No Text by Artist NT')).toHaveAttribute('src', '/placeholder-image.png');
  });

});
