import { GET } from './route';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));

jest.mock('../../../lib/redis', () => ({
  redis: {
    ping: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

import { redis } from '../../../lib/redis';

const mockPing = redis.ping as jest.Mock;

describe('GET /api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with ok status when Redis is reachable', async () => {
    mockPing.mockResolvedValueOnce('PONG');

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'ok', redis: 'connected' });
  });

  it('returns 503 with degraded status when Redis is unreachable', async () => {
    mockPing.mockRejectedValueOnce(new Error('Connection refused'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: 'degraded', redis: 'error' });
  });
});
