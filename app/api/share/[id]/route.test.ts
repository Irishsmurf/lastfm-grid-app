import { GET } from './route';
import { redis } from '../../../../lib/redis';
import { SharedGridData } from '../../../../lib/types';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));

jest.mock('../../../../lib/redis', () => ({
  redis: {
    get: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('../../../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

describe('GET /api/share/[id]', () => {
  const mockId = 'test-id';

  const mockSharedData: SharedGridData = {
    id: mockId,
    username: 'testuser',
    period: '7day',
    albums: [
      {
        name: 'Album1',
        artist: { name: 'Artist1', mbid: '' },
        imageUrl: 'url1',
        mbid: '',
        playcount: 10,
      },
    ],
    createdAt: new Date().toISOString(),
  };

  const makeContext = (id: string) => ({
    params: Promise.resolve({ id }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 with SharedGridData if found in Redis', async () => {
    (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(mockSharedData));

    const response = await GET({} as any, makeContext(mockId));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockSharedData);
    expect(redis.get).toHaveBeenCalledWith(`share:${mockId}`);
  });

  it('should return 404 if ID not found in Redis', async () => {
    (redis.get as jest.Mock).mockResolvedValue(null);

    const response = await GET({} as any, makeContext(mockId));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ message: 'Shared grid not found' });
    expect(redis.get).toHaveBeenCalledWith(`share:${mockId}`);
  });

  it('should return 500 if Redis get throws an error', async () => {
    (redis.get as jest.Mock).mockRejectedValue(new Error('Redis error'));

    const response = await GET({} as any, makeContext(mockId));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ message: 'Error retrieving shared grid' });
    expect(redis.get).toHaveBeenCalledWith(`share:${mockId}`);
  });

  it('should return 400 if ID parameter is missing', async () => {
    const response = await GET({} as any, makeContext(''));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ message: 'ID parameter is missing' });
    expect(redis.get).not.toHaveBeenCalled();
  });
});
