import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SharePageClient from './SharePageClient';
import { SharedGridData } from '@/lib/types';

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    priority,
  }: {
    src: string;
    alt: string;
    priority?: boolean;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-priority={priority ? 'true' : 'false'} />
  ),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockSharedData: SharedGridData = {
  id: 'test-share-id',
  username: 'testuser',
  period: '7day',
  albums: [
    {
      name: 'Album 1',
      artist: { name: 'Artist A', mbid: 'artist-mbid-a' },
      imageUrl: 'img1.jpg',
      mbid: 'album-mbid-1',
      playcount: 10,
    },
    {
      name: 'Album 2',
      artist: { name: 'Artist B', mbid: 'artist-mbid-b' },
      imageUrl: 'img2.jpg',
      mbid: 'album-mbid-2',
      playcount: 5,
    },
  ],
  createdAt: new Date().toISOString(),
};

describe('SharePageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the grid from server-provided props', () => {
    render(
      <SharePageClient
        sharedData={mockSharedData}
        spotifyLinks={{}}
        periodLabel="Last Week"
      />
    );

    // The username sits in its own <span> for styling, so the accessible-name
    // algorithm joins it with the trailing text using a space even though
    // nothing is rendered between them visually — match loosely.
    expect(
      screen.getByRole('heading', {
        name: new RegExp(`${mockSharedData.username}\\s*'s grid`),
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes('Last Week'))
    ).toBeInTheDocument();
    expect(screen.getByText('Album 1')).toBeInTheDocument();
    expect(screen.getByText('Artist A')).toBeInTheDocument();
    expect(screen.getByText('Album 2')).toBeInTheDocument();
    expect(screen.getByText('Artist B')).toBeInTheDocument();
  });

  it('makes no network requests — the server already resolved everything', () => {
    render(
      <SharePageClient
        sharedData={mockSharedData}
        spotifyLinks={{ 'album-mbid-1': 'https://open.spotify.com/album/1' }}
        periodLabel="Last Week"
      />
    );

    // Previously this component re-fetched the share record it was already given
    // and then fired one Spotify request per album.
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('renders a Spotify link and cue only for albums that have one', () => {
    render(
      <SharePageClient
        sharedData={mockSharedData}
        spotifyLinks={{
          'album-mbid-1': 'https://open.spotify.com/album/1',
          'album-mbid-2': null,
        }}
        periodLabel="Last Week"
      />
    );

    const spotifyAnchors = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.includes('open.spotify.com'));

    expect(spotifyAnchors).toHaveLength(1);
    expect(spotifyAnchors[0]).toHaveAttribute(
      'href',
      'https://open.spotify.com/album/1'
    );

    // One cue image for the linked album, one overlay logo — and nothing for the
    // album without a link.
    expect(screen.getAllByAltText('Spotify Playable Cue')).toHaveLength(1);
    expect(screen.getAllByAltText('Play on Spotify')).toHaveLength(1);
  });

  it('marks only the first album image as priority', () => {
    render(
      <SharePageClient
        sharedData={mockSharedData}
        spotifyLinks={{}}
        periodLabel="Last Week"
      />
    );

    const albumImages = screen
      .getAllByRole('img')
      .filter((img) => img.getAttribute('alt')?.includes(' by '));

    expect(albumImages).toHaveLength(2);
    expect(albumImages[0]).toHaveAttribute('data-priority', 'true');
    expect(albumImages[1]).toHaveAttribute('data-priority', 'false');
  });

  it('falls back to a local placeholder when album art is missing', () => {
    const withMissingArt: SharedGridData = {
      ...mockSharedData,
      albums: [{ ...mockSharedData.albums[0], imageUrl: '' }],
    };

    render(
      <SharePageClient
        sharedData={withMissingArt}
        spotifyLinks={{}}
        periodLabel="Last Week"
      />
    );

    expect(screen.getByAltText('Album 1 by Artist A')).toHaveAttribute(
      'src',
      '/placeholder-album.svg'
    );
  });
});
