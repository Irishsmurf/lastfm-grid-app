import { GET } from './route';
import { NextRequest } from 'next/server';
import { redis } from '../../../../lib/redis'; // Adjusted path

// Mock Redis
jest.mock('../../../../lib/redis', () => ({ // Adjusted path for mock
  redis: {
    get: jest.fn(),
  },
}));

// Helper to create a mock GET request
const createMockGetRequest = (collectionId: string) => {
  const url = `http://localhost:3000/api/share/${collectionId}`;
  // The actual Request object is fine for route handlers, but casting for type consistency in tests.
  return new NextRequest(url) as NextRequest;
};

describe('GET /api/share/[collectionId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return collection data if found in Redis', async () => {
    const mockCollectionId = 'test-collection-id';
    const mockCollectionData = {
      id: mockCollectionId,
      username: 'testuser',
      period: '7day',
      title: 'My Collection',
      albumsData: [{ name: 'Album 1' }],
      createdAt: new Date().toISOString(),
    };
    (redis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockCollectionData));

    const req = createMockGetRequest(mockCollectionId);
    // GET expects params in the second argument for dynamic routes
    const response = await GET(req, { params: { collectionId: mockCollectionId } });
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData).toEqual(mockCollectionData);
    expect(redis.get).toHaveBeenCalledWith(`sharedCollection:${mockCollectionId}`);
  });

  it('should return 404 if collection not found in Redis', async () => {
    const mockCollectionId = 'non-existent-id';
    (redis.get as jest.Mock).mockResolvedValueOnce(null);

    const req = createMockGetRequest(mockCollectionId);
    const response = await GET(req, { params: { collectionId: mockCollectionId } });
    const responseData = await response.json();

    expect(response.status).toBe(404);
    expect(responseData.error).toBe('Collection not found.');
    expect(redis.get).toHaveBeenCalledWith(`sharedCollection:${mockCollectionId}`);
  });

  it('should return 500 if Redis get operation fails', async () => {
    const mockCollectionId = 'test-collection-id';
    const redisErrorMessage = 'Redis connection failed';
    (redis.get as jest.Mock).mockRejectedValueOnce(new Error(redisErrorMessage));

    const req = createMockGetRequest(mockCollectionId);
    const response = await GET(req, { params: { collectionId: mockCollectionId } });
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toContain('Error retrieving collection from Redis.');
    expect(responseData.error).toContain(redisErrorMessage);
  });

  it('should return 500 if JSON parsing fails for data from Redis', async () => {
    const mockCollectionId = 'malformed-data-id';
    const malformedJsonString = '{"id": "test", name: "Missing quotes"}'; // Invalid JSON
    (redis.get as jest.Mock).mockResolvedValueOnce(malformedJsonString);

    const req = createMockGetRequest(mockCollectionId);
    const response = await GET(req, { params: { collectionId: mockCollectionId } });
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toBe('Failed to parse collection data.');
  });

  it('should return 400 if collectionId is missing from params (though Next.js routing might prevent this)', async () => {
    // This test case is more for completeness of the handler logic,
    // as Next.js dynamic routing typically ensures the parameter is present if the route matches.
    const req = createMockGetRequest('fakeId'); // ID in URL doesn't matter if params is empty
    const response = await GET(req, { params: { collectionId: '' } }); // Simulate empty collectionId
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toBe('Collection ID is required.');
    expect(redis.get).not.toHaveBeenCalled();
  });
});
