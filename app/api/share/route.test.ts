import { POST } from './route';
import { NextRequest } from 'next/server';
import { redis } from '../../../lib/redis';
// Removed: import { randomUUID } from 'crypto'; // Was unused

// Mock dependencies
jest.mock('../../../lib/redis', () => ({
  redis: {
    set: jest.fn(),
    // get: jest.fn(), // Not used in POST but good for consistency if needed elsewhere
  },
}));

// Mock crypto.randomUUID
const mockRandomUUID = jest.fn();
// Ensure 'crypto' module is still mocked for randomUUID if other parts of 'crypto' are used.
// If randomUUID was the *only* thing, this specific mock could be simplified,
// but it's safer to keep the structure if other crypto functions might be used elsewhere.
jest.mock('crypto', () => {
  const actualCrypto = jest.requireActual('crypto');
  return {
    ...actualCrypto,
    randomUUID: () => mockRandomUUID(),
  };
});


const mockFetch = jest.fn();
global.fetch = mockFetch;

// Helper to create a mock POST request
const createMockPostRequest = (body: any) => {
  const url = 'http://localhost:3000/api/share';
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

describe('POST /api/share', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';
    process.env.LASTFM_API_KEY = 'testapikey';
    mockRandomUUID.mockReturnValue('mock-uuid-123'); // Default mock UUID
  });

  it('should create a shared collection successfully', async () => {
    const mockBody = {
      username: 'testuser',
      period: '7day',
      title: 'My Test Collection',
      description: 'A cool collection.',
    };
    const mockLastFmData = {
      topalbums: {
        album: [{ name: 'Album 1', artist: 'Artist A' }],
      },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockLastFmData),
    });
    (redis.set as jest.Mock).mockResolvedValueOnce('OK');

    const req = createMockPostRequest(mockBody);
    const response = await POST(req);
    const responseData = await response.json();

    expect(response.status).toBe(201);
    expect(responseData.message).toBe('Shared collection created successfully.');
    expect(responseData.collectionId).toBe('mock-uuid-123');
    expect(mockFetch).toHaveBeenCalledWith(
      `${process.env.LASTFM_BASE_URL}?method=user.gettopalbums&user=${mockBody.username}&period=${mockBody.period}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=9`
    );
    expect(redis.set).toHaveBeenCalledWith(
      `sharedCollection:mock-uuid-123`,
      expect.stringContaining('"id":"mock-uuid-123"')
    );
    const redisCallArg = JSON.parse((redis.set as jest.Mock).mock.calls[0][1]);
    expect(redisCallArg.albumsData).toEqual(mockLastFmData.topalbums.album);
    expect(redisCallArg.title).toBe(mockBody.title);
  });

  it('should return 400 if username is missing', async () => {
    const req = createMockPostRequest({ period: '7day', title: 'Title' });
    const response = await POST(req);
    const responseData = await response.json();
    expect(response.status).toBe(400);
    expect(responseData.error).toContain('Missing required parameters');
  });

  it('should return 400 if period is missing', async () => {
    const req = createMockPostRequest({ username: 'user', title: 'Title' });
    const response = await POST(req);
    const responseData = await response.json();
    expect(response.status).toBe(400);
    expect(responseData.error).toContain('Missing required parameters');
  });

  it('should return 400 if title is missing', async () => {
    const req = createMockPostRequest({ username: 'user', period: '7day' });
    const response = await POST(req);
    const responseData = await response.json();
    expect(response.status).toBe(400);
    expect(responseData.error).toContain('Missing required parameters');
  });

  it('should return 400 for invalid JSON payload', async () => {
    const url = 'http://localhost:3000/api/share';
    const req = new NextRequest(url, {
        method: 'POST',
        body: "{malformed json: 'test'}", // Invalid JSON
        headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(req);
    const responseData = await response.json();
    expect(response.status).toBe(400);
    expect(responseData.error).toBe('Invalid JSON payload.');
  });

  it('should return 502 if Last.fm API fetch fails (response not ok)', async () => {
    const mockBody = { username: 'testuser', period: '7day', title: 'Test' };
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'LastFM Error', // Mock the text() method
    });

    const req = createMockPostRequest(mockBody);
    const response = await POST(req);
    const responseData = await response.json();

    expect(response.status).toBe(502);
    expect(responseData.error).toBe('Failed to fetch album data from Last.fm.');
    expect(redis.set).not.toHaveBeenCalled();
  });

    it('should return 502 if Last.fm API returns an error object', async () => {
    const mockBody = { username: 'testuser', period: '7day', title: 'Test' };
    const mockLastFmError = { error: 10, message: "Invalid API key" };
    mockFetch.mockResolvedValueOnce({
      ok: true, // Response itself is ok, but content indicates an error
      json: jest.fn().mockResolvedValueOnce(mockLastFmError),
    });

    const req = createMockPostRequest(mockBody);
    const response = await POST(req);
    const responseData = await response.json();

    expect(response.status).toBe(502);
    expect(responseData.error).toBe(`Last.fm API error: ${mockLastFmError.message}`);
    expect(redis.set).not.toHaveBeenCalled();
  });


  it('should return 503 if Last.fm API fetch throws an error (network error)', async () => {
    const mockBody = { username: 'testuser', period: '7day', title: 'Test' };
    mockFetch.mockRejectedValueOnce(new Error('Network connection error'));

    const req = createMockPostRequest(mockBody);
    const response = await POST(req);
    const responseData = await response.json();

    expect(response.status).toBe(503);
    expect(responseData.error).toContain('Failed to communicate with Last.fm API.');
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('should return 500 if Last.fm response structure is unexpected', async () => {
    const mockBody = { username: 'testuser', period: '7day', title: 'Test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ unexpected: "data" }), // Malformed/unexpected structure
    });

    const req = createMockPostRequest(mockBody);
    const response = await POST(req);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toBe('Unexpected data structure from Last.fm.');
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('should return 500 if Redis set fails', async () => {
    const mockBody = { username: 'testuser', period: '7day', title: 'Test' };
    const mockLastFmData = { topalbums: { album: [] } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockLastFmData),
    });
    (redis.set as jest.Mock).mockRejectedValueOnce(new Error('Redis unavailable'));

    const req = createMockPostRequest(mockBody);
    const response = await POST(req);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toContain('Failed to store collection data.');
    expect(responseData.error).toContain('Redis unavailable');
  });
});
