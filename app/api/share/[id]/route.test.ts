import { GET } from './route'; // Adjust path as necessary
import { NextRequest } from 'next/server';
import { redis } from '../../../../lib/redis'; // Adjust path
import { SharedGridData } from '../../../../lib/types'; // Adjust path

// Mock ioredis
jest.mock('../../../../lib/redis', () => ({
  redis: {
    get: jest.fn(),
  },
}));

describe('GET /api/share/[id]', () => {
  const mockRequest = (id: string) => {
    return {
      nextUrl: { searchParams: new URLSearchParams() }, // Simplified mock
      // other properties as needed by NextRequest
    } as NextRequest;
  };

  const mockId = 'test-id';
  const mockSharedData: SharedGridData = {
    id: mockId,
    username: 'testuser',
    period: '7day',
    albums: [{ name: 'Album1', artist: 'Artist1', image: 'url1' }],
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 with SharedGridData if found in Redis', async () => {
    (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(mockSharedData));

    const response = await GET(mockRequest(mockId), { params: { id: mockId } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockSharedData);
    expect(redis.get).toHaveBeenCalledWith(`share:${mockId}`);
  });

  it('should return 404 if ID not found in Redis', async () => {
    (redis.get as jest.Mock).mockResolvedValue(null);

    const response = await GET(mockRequest(mockId), { params: { id: mockId } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ message: 'Shared grid not found' });
    expect(redis.get).toHaveBeenCalledWith(`share:${mockId}`);
  });

  it('should return 500 if Redis get throws an error', async () => {
    (redis.get as jest.Mock).mockRejectedValue(new Error('Redis error'));

    const response = await GET(mockRequest(mockId), { params: { id: mockId } });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ message: 'Error retrieving shared grid' });
    expect(redis.get).toHaveBeenCalledWith(`share:${mockId}`);
  });

  it('should return 400 if ID parameter is missing (though route structure makes this unlikely)', async () => {
    // This case is more for robustness, Next.js routing typically ensures param.id exists
    // For this test, we'll simulate it by passing an empty id, though GET won't be called this way
    const response = await GET(mockRequest(''), { params: { id: '' } });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toEqual({ message: 'ID parameter is missing' });
     // redis.get should not be called if id is missing
    expect(redis.get).not.toHaveBeenCalled();
  });
});
