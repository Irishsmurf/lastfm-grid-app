import { POST } from './route';
import { redis } from '../../../lib/redis';

jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn(
      (
        body: unknown,
        init?: { status?: number; headers?: Record<string, string> }
      ) => ({
        status: init?.status ?? 200,
        headers: new Headers(init?.headers ?? {}),
        json: async () => body,
      })
    ),
  },
}));

jest.mock('../../../lib/redis', () => ({
  redis: { set: jest.fn(), on: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock('../../../lib/metrics', () => ({
  apiRequestCounter: { inc: jest.fn() },
}));

jest.mock('nanoid', () => ({ nanoid: jest.fn(() => 'generated-id') }));

const validAlbum = {
  name: 'Test Album',
  artist: { name: 'Test Artist', mbid: 'artist-mbid' },
  imageUrl: 'art.jpg',
  mbid: 'album-mbid',
  playcount: 10,
};

// Minimal NextRequest stand-in: the route only ever calls .json().
const makeRequest = (body: unknown): Parameters<typeof POST>[0] =>
  ({
    json: async () => {
      if (body === undefined) throw new Error('Invalid JSON');
      return body;
    },
  }) as unknown as Parameters<typeof POST>[0];

describe('POST /api/share', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redis.set as jest.Mock).mockResolvedValue('OK');
  });

  it('creates a share record and returns its id', async () => {
    const response = await POST(
      makeRequest({
        username: 'testuser',
        period: '1month',
        albums: [validAlbum],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.sharedId).toBe('generated-id');

    expect(redis.set).toHaveBeenCalledTimes(1);
    const [key, payload] = (redis.set as jest.Mock).mock.calls[0];
    expect(key).toBe('share:generated-id');

    const stored = JSON.parse(payload);
    expect(stored).toMatchObject({
      id: 'generated-id',
      username: 'testuser',
      period: '1month',
      albums: [validAlbum],
    });
    expect(typeof stored.createdAt).toBe('string');
  });

  it('stores share records without an expiry so links never break', async () => {
    await POST(
      makeRequest({
        username: 'testuser',
        period: '1month',
        albums: [validAlbum],
      })
    );

    // Two args only — no EX/PX. A TTL here would silently break old share links.
    expect((redis.set as jest.Mock).mock.calls[0]).toHaveLength(2);
  });

  it('never caches its response', async () => {
    const response = await POST(
      makeRequest({
        username: 'testuser',
        period: '1month',
        albums: [validAlbum],
      })
    );
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it.each([
    ['malformed JSON', undefined],
    ['a missing username', { period: '1month', albums: [validAlbum] }],
    [
      'a too-short username',
      { username: 'a', period: '1month', albums: [validAlbum] },
    ],
    [
      'an invalid period',
      { username: 'testuser', period: 'yesterday', albums: [validAlbum] },
    ],
    ['missing albums', { username: 'testuser', period: '1month' }],
    [
      'an empty album list',
      { username: 'testuser', period: '1month', albums: [] },
    ],
    [
      'more albums than a grid holds',
      {
        username: 'testuser',
        period: '1month',
        albums: Array.from({ length: 26 }, () => validAlbum),
      },
    ],
    [
      'malformed album entries',
      {
        username: 'testuser',
        period: '1month',
        albums: [{ name: 'no artist' }],
      },
    ],
  ])('rejects %s with 400 and writes nothing', async (_label, body) => {
    const response = await POST(makeRequest(body));

    expect(response.status).toBe(400);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('returns 503 when Redis is unavailable', async () => {
    (redis.set as jest.Mock).mockRejectedValue(new Error('Redis down'));

    const response = await POST(
      makeRequest({
        username: 'testuser',
        period: '1month',
        albums: [validAlbum],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.message).toContain('Failed to save share data');
  });
});
