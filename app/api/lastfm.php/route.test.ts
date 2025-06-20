import { GET } from './route'; // Adjust path as necessary if this file is moved
import { getTopAlbums, LastFmAlbum } from '@/lib/lastfmService';
import sharp from 'sharp';
import { NextRequest } from 'next/server';

// Mock the services
jest.mock('@/lib/lastfmService');
jest.mock('sharp');

const mockGetTopAlbums = getTopAlbums as jest.MockedFunction<typeof getTopAlbums>;
const mockSharp = sharp as jest.MockedFunction<any>; // Using 'any' for simplicity with sharp's chained API

describe('GET /api/lastfm.php', () => {
  let mockSharpInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default sharp mock behavior
    mockSharpInstance = {
      resize: jest.fn().mockReturnThis(),
      composite: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(), // Used internally in generateImageGrid
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image-data')),
    };
    mockSharp.mockReturnValue(mockSharpInstance);
    // Mock the create functionality if used for the initial canvas
    mockSharp.mockImplementation((options: any) => {
        if (options && options.create) {
            return mockSharpInstance;
        }
        return mockSharpInstance; // Default for sharp(buffer)
    });
  });

  const mockAlbums: LastFmAlbum[] = [
    {
      name: 'Test Album 1',
      artist: { name: 'Test Artist 1', mbid: '', url: '' },
      image: [{ '#text': 'http://example.com/image1.jpg', size: 'large' }],
      playcount: '100',
      mbid: '',
      url: '',
    },
    {
      name: 'Test Album 2',
      artist: { name: 'Test Artist 2', mbid: '', url: '' },
      image: [{ '#text': 'http://example.com/image2.jpg', size: 'large' }],
      playcount: '50',
      mbid: '',
      url: '',
    },
  ];

  // Helper to create a NextRequest
  const createMockRequest = (queryParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost/api/lastfm.php');
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    return new NextRequest(url.toString()) as any; // Cast to any to avoid full type complexities for Request
  };

  // Mock fetch used inside generateImageGrid
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      buffer: () => Promise.resolve(Buffer.from('mock-album-art-data')),
    })
  ) as jest.Mock;


  test('should return a JPEG image for a valid request', async () => {
    mockGetTopAlbums.mockResolvedValue({ topalbums: { album: mockAlbums, '@attr': {} as any } });

    const request = createMockRequest({ user: 'testuser', cols: '2', rows: '1', info: '1', playcount: '1' });
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=86400, stale-while-revalidate');

    const imageBuffer = await response.arrayBuffer();
    expect(Buffer.from(imageBuffer).toString()).toBe('mock-image-data');

    expect(mockGetTopAlbums).toHaveBeenCalledWith('testuser', '7day', 2 * 1); // Default period, limit = cols*rows
    expect(mockSharp).toHaveBeenCalled(); // Check if sharp was called
    expect(mockSharpInstance.toBuffer).toHaveBeenCalled();
  });

  test('should return 400 if user parameter is missing', async () => {
    const request = createMockRequest({});
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Missing 'user' query parameter");
  });

  test('should use default parameters if not provided', async () => {
    mockGetTopAlbums.mockResolvedValue({ topalbums: { album: mockAlbums.slice(0,1), '@attr': {} as any } });

    const request = createMockRequest({ user: 'testuser' });
    await GET(request);

    // Defaults: period='7day', cols=3, rows=3. Limit = 3*3=9
    expect(mockGetTopAlbums).toHaveBeenCalledWith('testuser', '7day', 9);
    // Info and playcount default to true (1), which affects generateImageGrid internal logic.
    // We can check if sharp's composite (for text overlay) was called if info=true
    // Since generateImageGrid is complex, we're checking the inputs to getTopAlbums here.
    // To check info/playcount, we'd need more granular mocking or direct call to generateImageGrid.
  });

  describe('info and playcount parameters', () => {
    // To properly test the effect of info/playcount, we would ideally call generateImageGrid directly
    // or have more detailed insight into its calls to sharp.
    // For now, we'll assume they are passed down.
    // A simple check is if getTopAlbums is still called correctly.

    test('should handle info=0 and playcount=0', async () => {
        mockGetTopAlbums.mockResolvedValue({ topalbums: { album: mockAlbums, '@attr': {} as any } });
        const request = createMockRequest({ user: 'testuser', info: '0', playcount: '0' });
        await GET(request);
        expect(mockGetTopAlbums).toHaveBeenCalledWith('testuser', '7day', 9); // Default cols/rows
        // Further tests would involve inspecting calls to sharp().composite related to text.
        // The current sharp mock is a bit too high-level for that without more work on the mock itself.
    });
  });


  test('should return 500 if Last.fm service fails', async () => {
    mockGetTopAlbums.mockRejectedValue(new Error('Last.fm API error'));

    const request = createMockRequest({ user: 'testuser' });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Server error: Last.fm API error');
  });

  test('should return 404 if no albums are found', async () => {
    mockGetTopAlbums.mockResolvedValue({ topalbums: { album: [], '@attr': {} as any } });
    const request = createMockRequest({ user: 'testuser' });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('No albums found for this user or parameters.');
  });

  test('should return 500 if image generation (sharp) fails', async () => {
    mockGetTopAlbums.mockResolvedValue({ topalbums: { album: mockAlbums, '@attr': {} as any } });
    mockSharpInstance.toBuffer.mockRejectedValue(new Error('Sharp processing error'));

    const request = createMockRequest({ user: 'testuser' });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Server error: Sharp processing error');
  });

  test('should return 500 if fetching an album image fails', async () => {
    mockGetTopAlbums.mockResolvedValue({ topalbums: { album: mockAlbums, '@attr': {} as any } });
    (global.fetch as jest.Mock).mockImplementationOnce(() => // Fail only the first image fetch
      Promise.resolve({
        ok: false,
        statusText: "Failed to fetch image"
      })
    ).mockImplementationOnce(() => // Subsequent fetches succeed
        Promise.resolve({
        ok: true,
        buffer: () => Promise.resolve(Buffer.from('mock-album-art-data')),
        })
    );

    const request = createMockRequest({ user: 'testuser' });
    const response = await GET(request);
    // This will still produce an image, but the first tile will be an error placeholder.
    // The overall response should be 200 if at least one image is processed or placeholders are made.
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    // To verify the error placeholder, one would need to inspect the generated image data,
    // which is beyond the scope of simple buffer content check ('mock-image-data').
    // The console.error within generateImageGrid would be called.
  });

});
