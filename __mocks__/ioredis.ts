// __mocks__/ioredis.ts
const mockRedisStore: Record<string, string> = {};

const mockRedis = {
  get: jest.fn((key: string) => Promise.resolve(mockRedisStore[key] || null)),
  set: jest.fn((key: string, value: string, _mode?: string, _duration?: number) => {
    mockRedisStore[key] = value;
    return Promise.resolve('OK');
  }),
  del: jest.fn((key: string) => {
    delete mockRedisStore[key];
    return Promise.resolve(1);
  }),
  // Helper to clear the store for tests
  clear: jest.fn(() => {
    for (const key in mockRedisStore) {
      delete mockRedisStore[key];
    }
    return Promise.resolve('OK');
  }),
};

const Redis = jest.fn(() => mockRedis);

// Static member for the instance mock
(Redis as any).mockInstance = mockRedis;

export default Redis;
