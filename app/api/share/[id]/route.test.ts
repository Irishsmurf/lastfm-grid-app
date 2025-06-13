// app/api/share/[id]/route.test.ts
import { GET } from './route'; // Adjust if your handler is exported differently
import { redis } from '@/lib/redis';
import { NextRequest } from 'next/server';
import { SharedGridData } from '@/lib/types';

// Mock Redis
jest.mock('@/lib/redis', () => ({
  redis: {
    get: jest.fn(),
  },
}));

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('GET /api/share/[id]', () => {
  const mockReq = (id?: string) => {
    const url = id ? `http://localhost/api/share/${id}` : 'http://localhost/api/share/';
    return new NextRequest(url) as NextRequest;
  };

  beforeEach(() => {
    // Reset mocks before each test
    (redis.get as jest.Mock).mockReset();
  });

  it('should return 400 if ID is missing', async () => {
    // Simulate calling without params in a way that params.id would be undefined
    // For this route structure, an ID in the path is required for the route to match.
    // A direct call to GET without params might not fully simulate Next.js routing if ID is part of path.
    // However, the internal check `if (!id)` is what we are testing.
    // A more accurate test would involve Next.js test utilities for routing, but this checks the handler logic.
    // Let's assume the framework passes params correctly. If id is empty string, it should be caught.
    const response = await GET(mockReq(''), { params: { id: '' } });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.message).toBe('ID is required');
  });

  it('should return shared grid data if ID is found in Redis', async () => {
    const mockId = 'test-id';
    const mockData: SharedGridData = {
      id: mockId,
      username: 'testuser',
      period: '1month',
      albums: [],
      createdAt: new Date().toISOString(),
    };
    (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(mockData));

    const response = await GET(mockReq(mockId), { params: { id: mockId } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(mockData);
    expect(redis.get).toHaveBeenCalledWith(`sharedGrid:${mockId}`);
  });

  it('should return 404 if ID is not found in Redis', async () => {
    const mockId = 'not-found-id';
    (redis.get as jest.Mock).mockResolvedValue(null);

    const response = await GET(mockReq(mockId), { params: { id: mockId } });
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.message).toBe('Grid not found');
  });

  it('should return 500 if Redis throws an error', async () => {
    const mockId = 'error-id';
    (redis.get as jest.Mock).mockRejectedValue(new Error('Redis error'));

    const response = await GET(mockReq(mockId), { params: { id: mockId } });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.message).toBe('Error fetching shared grid');
  });

  it('should return 500 if JSON.parse throws an error for corrupted data', async () => {
    const mockId = 'corrupted-id';
    (redis.get as jest.Mock).mockResolvedValue('this is not json');

    const response = await GET(mockReq(mockId), { params: { id: mockId } });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.message).toBe('Error fetching shared grid');
    // Optionally check for the specific error message if it's important
    // expect(body.error).toContain('Unexpected token');
  });
});
