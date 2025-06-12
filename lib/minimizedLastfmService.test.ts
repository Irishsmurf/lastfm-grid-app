// lib/minimizedLastfmService.test.ts
import { transformLastFmResponse } from './minimizedLastfmService';
import { LastFmTopAlbumsResponse, LastFmAlbum } from './lastfmService'; // For constructing mock input

describe('transformLastFmResponse', () => {
  const mockArtist = { name: 'Test Artist', mbid: 'artist-mbid', url: 'artist-url' };
  const mockImages = [
    { '#text': 'small.jpg', size: 'small' },
    { '#text': 'medium.jpg', size: 'medium' },
    { '#text': 'large.jpg', size: 'large' },
    { '#text': 'extralarge.jpg', size: 'extralarge' },
  ];

  it('should transform a typical Last.fm response correctly', () => {
    const mockAlbum: LastFmAlbum = {
      name: 'Test Album',
      artist: mockArtist,
      image: mockImages,
      mbid: 'album-mbid',
      playcount: '100',
      url: 'album-url',
    };
    const mockResponse: LastFmTopAlbumsResponse = {
      topalbums: {
        album: [mockAlbum],
        '@attr': { user: 'testuser', totalPages: '1', page: '1', perPage: '1', total: '1' },
      },
    };

    const result = transformLastFmResponse(mockResponse);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'Test Album',
      artist: { name: 'Test Artist', mbid: 'artist-mbid' },
      imageUrl: 'extralarge.jpg',
      mbid: 'album-mbid',
      playcount: 100,
    });
  });

  it('should return an empty array if topalbums or album array is missing', () => {
    expect(transformLastFmResponse({ topalbums: undefined })).toEqual([]);
    expect(transformLastFmResponse({ topalbums: { album: [], '@attr': {} as any } })).toEqual([]);
    expect(transformLastFmResponse({} as LastFmTopAlbumsResponse)).toEqual([]);
  });

  it('should handle missing image array by setting imageUrl to empty string', () => {
    const mockAlbum: LastFmAlbum = {
      name: 'No Image Album',
      artist: mockArtist,
      image: [], // Empty image array
      mbid: 'no-image-mbid',
      playcount: '50',
      url: 'album-url',
    };
    const mockResponse: LastFmTopAlbumsResponse = {
      topalbums: { album: [mockAlbum], '@attr': {} as any },
    };
    const result = transformLastFmResponse(mockResponse);
    expect(result[0].imageUrl).toBe('');
  });

  it('should use the last available image if preferred image size (index 3) is not available', () => {
    const mockAlbum: LastFmAlbum = {
      name: 'Fallback Image Album',
      artist: mockArtist,
      image: [mockImages[0], mockImages[1]], // Only small and medium images
      mbid: 'fallback-mbid',
      playcount: '75',
      url: 'album-url',
    };
    const mockResponse: LastFmTopAlbumsResponse = {
      topalbums: { album: [mockAlbum], '@attr': {} as any },
    };
    const result = transformLastFmResponse(mockResponse);
    expect(result[0].imageUrl).toBe('medium.jpg'); // Should fallback to the last one
  });

  it('should handle completely missing image property by setting imageUrl to empty string', () => {
    const mockAlbum = { // Deliberately not typed as LastFmAlbum to test missing 'image'
      name: 'Missing Image Prop Album',
      artist: mockArtist,
      // image property is completely missing
      mbid: 'missing-image-prop-mbid',
      playcount: '50',
      url: 'album-url',
    } as LastFmAlbum; // Cast to satisfy map function, but test the missing property
    const mockResponse: LastFmTopAlbumsResponse = {
      topalbums: { album: [mockAlbum], '@attr': {} as any },
    };
    const result = transformLastFmResponse(mockResponse);
    expect(result[0].imageUrl).toBe('');
  });

  it('should parse playcount to number and default to 0 if invalid', () => {
    const mockAlbum1: LastFmAlbum = {
      name: 'Valid Playcount',
      artist: mockArtist,
      image: mockImages,
      mbid: 'pc-mbid1',
      playcount: '123',
      url: 'url1',
    };
    const mockAlbum2: LastFmAlbum = {
      name: 'Invalid Playcount',
      artist: mockArtist,
      image: mockImages,
      mbid: 'pc-mbid2',
      playcount: 'not-a-number',
      url: 'url2',
    };
    const mockResponse: LastFmTopAlbumsResponse = {
      topalbums: { album: [mockAlbum1, mockAlbum2], '@attr': {} as any },
    };
    const result = transformLastFmResponse(mockResponse);
    expect(result[0].playcount).toBe(123);
    expect(result[1].playcount).toBe(0);
  });
});
