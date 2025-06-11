// app/api/playlist/route.test.ts
import { POST } from './route'; // Adjust path as necessary
import { NextRequest } from 'next/server';
import { Readable } from 'stream';

// Mock the lib/spotify module
jest.mock('@/lib/spotify');

// Import the mocked functions to spy on them or provide mock implementations
import {
  getUserAuthorizedSpotifyApi,
  getAuthorizationUrl,
  searchAlbums,
  getAlbumTracks,
  getTracksDetails,
  getCurrentUserProfile,
  createPlaylist,
  addTracksToPlaylist,
  clearUserTokens
} from '@/lib/spotify';

// Helper to create a mock NextRequest
function createMockNextRequest(body: any, method: string = 'POST'): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const stream = new Readable({
    read() {
      this.push(JSON.stringify(body));
      this.push(null);
    }
  });
  // TODO: req.json() is not available on NextRequest in this manner for older Next versions.
  // Modern Next.js Edge runtime request might be different.
  // For now, assuming this simplified mock works with how req.json() is typically polyfilled or handled in tests.
  // A more robust mock might involve using something like `node-mocks-http`.
  // Or, if using a version of Next.js where NextRequest has a native `json` method that can be mocked:
   const mockReq = new NextRequest(new Request('http://localhost/api/playlist', { method, headers, body: stream as any }));

   // If direct body mocking is problematic, mock the .json() method itself:
   // mockReq.json = jest.fn().mockResolvedValue(body); // This is often the most reliable for unit tests.
   // For this setup, we'll try mocking .json() directly on the instance if the stream method is problematic.

  return mockReq;
}


describe('POST /api/playlist', () => {
  let mockSpotifyApi: any;

  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mocks

    // Mock return value for getUserAuthorizedSpotifyApi
    mockSpotifyApi = {
      // Mock any methods from SpotifyWebApi that are directly called if not using service's wrappers
      // For this route, we primarily use the wrapper functions from @/lib/spotify
    };

    (getUserAuthorizedSpotifyApi as jest.Mock).mockResolvedValue(mockSpotifyApi); // Default to user being authorized
    (getAuthorizationUrl as jest.Mock).mockReturnValue('http://spotify.com/auth?test-state');
    (getCurrentUserProfile as jest.Mock).mockResolvedValue({ body: { id: 'test-user-id' } });
    (createPlaylist as jest.Mock).mockResolvedValue({
        body: { id: 'test-playlist-id', external_urls: { spotify: 'http://spotify.com/playlist/test' } }
    });
    (addTracksToPlaylist as jest.Mock).mockResolvedValue({ body: { snapshot_id: 'snapshot-id' } });
    (searchAlbums as jest.Mock).mockResolvedValue({ body: { albums: { items: [] } } }); // Default to no albums found
    (getAlbumTracks as jest.Mock).mockResolvedValue({ body: { items: [] } }); // Default to no tracks
    (getTracksDetails as jest.Mock).mockResolvedValue([]); // Default to no detailed tracks
  });

  it('should return 400 if albums data is missing or invalid', async () => {
    let req = createMockNextRequest(null); // No body
    (req.json as jest.Mock) = jest.fn().mockResolvedValue(null);
    let response = await POST(req);
    expect(response.status).toBe(400);

    req = createMockNextRequest({ albums: 'not-an-array' });
    (req.json as jest.Mock) = jest.fn().mockResolvedValue({ albums: 'not-an-array' });
    response = await POST(req);
    expect(response.status).toBe(400);

    req = createMockNextRequest({ albums: [] }); // Empty array
    (req.json as jest.Mock) = jest.fn().mockResolvedValue({ albums: [] });
    response = await POST(req);
    expect(response.status).toBe(400); // As per current logic
  });

  it('should return 401 with authorizeURL if user is not authorized', async () => {
    (getUserAuthorizedSpotifyApi as jest.Mock).mockResolvedValue(null); // Simulate user not authorized
    const req = createMockNextRequest({ albums: [{ albumName: 'Test Album', artistName: 'Test Artist' }] });
    (req.json as jest.Mock) = jest.fn().mockResolvedValue({ albums: [{ albumName: 'Test Album', artistName: 'Test Artist' }] });


    const response = await POST(req);
    const responseBody = await response.json();

    expect(response.status).toBe(401);
    expect(responseBody.authorizeURL).toBe('http://spotify.com/auth?test-state');
    expect(getAuthorizationUrl).toHaveBeenCalledWith('test-session-id'); // Assuming static session ID for now
  });

  it('should return 404 if no tracks are found for any albums', async () => {
    // searchAlbums will use its default mock (no albums found)
    const req = createMockNextRequest({ albums: [{ albumName: 'Unfound Album', artistName: 'Artist' }] });
     (req.json as jest.Mock) = jest.fn().mockResolvedValue({ albums: [{ albumName: 'Unfound Album', artistName: 'Artist' }] });

    const response = await POST(req);
    expect(response.status).toBe(404);
  });

  it('should create a playlist and return 201 on success', async () => {
    const albumsInput = [{ albumName: 'Abbey Road', artistName: 'The Beatles' }];
    (searchAlbums as jest.Mock).mockImplementation(async (_api, albumName, _artist) => {
        if (albumName === 'Abbey Road') {
            return { body: { albums: { items: [{ id: 'album-abbey-road', name: 'Abbey Road' }] } } };
        }
        return { body: { albums: { items: [] } } };
    });
    (getAlbumTracks as jest.Mock).mockImplementation(async (_api, albumId) => {
        if (albumId === 'album-abbey-road') {
            return { body: { items: [{ id: 'track1', uri: 'spotify:track:track1', name: 'Come Together' }, { id: 'track2', uri: 'spotify:track:track2', name: 'Something' }] } };
        }
        return { body: { items: [] } };
    });
    (getTracksDetails as jest.Mock).mockImplementation(async (_api, trackIds) => {
        if (trackIds.includes('track1')) { // simplified
            return [
                { id: 'track1', uri: 'spotify:track:track1', name: 'Come Together', popularity: 80 },
                { id: 'track2', uri: 'spotify:track:track2', name: 'Something', popularity: 78 },
            ];
        }
        return [];
    });

    const req = createMockNextRequest({ albums: albumsInput });
    (req.json as jest.Mock) = jest.fn().mockResolvedValue({ albums: albumsInput });

    const response = await POST(req);
    const responseBody = await response.json();

    expect(response.status).toBe(201);
    expect(responseBody.playlistUrl).toBe('http://spotify.com/playlist/test');
    expect(responseBody.message).toContain('Playlist created successfully');
    expect(getCurrentUserProfile).toHaveBeenCalledWith(mockSpotifyApi);
    expect(createPlaylist).toHaveBeenCalledWith(
      mockSpotifyApi,
      'test-user-id',
      expect.stringContaining('My Awesome Mix'),
      expect.any(String),
      false
    );
    expect(addTracksToPlaylist).toHaveBeenCalledWith(
      mockSpotifyApi,
      'test-playlist-id',
      ['spotify:track:track1', 'spotify:track:track2'] // Popularity sorting would ensure order if different
    );
  });

  it('should correctly sort tracks by popularity and select top N', async () => {
    const albumsInput = [{ albumName: 'Popular Hits', artistName: 'Various Artists' }];
    (searchAlbums as jest.Mock).mockResolvedValue({
        body: { albums: { items: [{ id: 'album-popular', name: 'Popular Hits' }] } }
    });
    (getAlbumTracks as jest.Mock).mockResolvedValue({
        body: { items: [ // Unsorted initially by popularity
            { id: 'trackA', uri: 'spotify:track:trackA', name: 'Track A' },
            { id: 'trackB', uri: 'spotify:track:trackB', name: 'Track B' },
            { id: 'trackC', uri: 'spotify:track:trackC', name: 'Track C' },
            { id: 'trackD', uri: 'spotify:track:trackD', name: 'Track D' },
        ] }
    });
    (getTracksDetails as jest.Mock).mockResolvedValue([ // Popularity data
        { id: 'trackA', uri: 'spotify:track:trackA', name: 'Track A', popularity: 70 },
        { id: 'trackB', uri: 'spotify:track:trackB', name: 'Track B', popularity: 90 },
        { id: 'trackC', uri: 'spotify:track:trackC', name: 'Track C', popularity: 60 },
        { id: 'trackD', uri: 'spotify:track:trackD', name: 'Track D', popularity: 80 },
    ]);

    const req = createMockNextRequest({ albums: albumsInput });
     (req.json as jest.Mock) = jest.fn().mockResolvedValue({ albums: albumsInput });

    await POST(req);

    // Expect addTracksToPlaylist to be called with tracks sorted by popularity (desc) and sliced (top 3)
    expect(addTracksToPlaylist).toHaveBeenCalledWith(
      expect.anything(), // API instance
      'test-playlist-id',
      ['spotify:track:trackB', 'spotify:track:trackD', 'spotify:track:trackA'] // B (90), D (80), A (70)
    );
  });

  it('should return 500 if Spotify API call fails during playlist creation', async () => {
    (getCurrentUserProfile as jest.Mock).mockRejectedValue({
        body: { error: { message: 'User profile fetch failed', status: 500 } },
        statusCode: 500
    }); // Simulate a failure

    const req = createMockNextRequest({ albums: [{ albumName: 'Test Album', artistName: 'Test Artist' }] });
    (req.json as jest.Mock) = jest.fn().mockResolvedValue({ albums: [{ albumName: 'Test Album', artistName: 'Test Artist' }] });


    const response = await POST(req);
    const responseBody = await response.json();
    expect(response.status).toBe(500);
    expect(responseBody.message).toContain('Spotify API Error: User profile fetch failed');
  });

  it('should trigger re-authorization if a 401/403 error occurs mid-process', async () => {
    (createPlaylist as jest.Mock).mockRejectedValue({
        body: { error: { message: 'Invalid access token', status: 401 } },
        statusCode: 401
    });
    const albumsInput = [{ albumName: 'Test Album', artistName: 'Test Artist' }];
     (searchAlbums as jest.Mock).mockResolvedValue({ body: { albums: { items: [{ id: 'album-id', name: 'Test Album'}] } } });
     (getAlbumTracks as jest.Mock).mockResolvedValue({ body: { items: [{ id: 'track-id', uri: 'uri'}] } });
     (getTracksDetails as jest.Mock).mockResolvedValue([{ id: 'track-id', uri: 'uri', popularity: 100 }]);


    const req = createMockNextRequest({ albums: albumsInput });
    (req.json as jest.Mock) = jest.fn().mockResolvedValue({ albums: albumsInput });

    const response = await POST(req);
    const responseBody = await response.json();

    expect(response.status).toBe(401);
    expect(responseBody.message).toContain('Spotify authorization error. Please re-authorize.');
    expect(responseBody.authorizeURL).toBe('http://spotify.com/auth?test-state');
    expect(clearUserTokens).toHaveBeenCalledWith('test-session-id');
  });

});
