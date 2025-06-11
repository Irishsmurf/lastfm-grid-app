import Redis from 'ioredis';

// Ensure REDIS_URL is defined, or provide a default that's clearly for local/dev if appropriate
// However, for build stability, the error handler is key regardless of the URL.
const redisUrl = process.env.REDIS_URL;

let redis: Redis;

if (redisUrl) {
  redis = new Redis(redisUrl);

  redis.on('error', (err) => {
    console.error('Redis Error:', err);
    // This handler is crucial to prevent unhandled errors from crashing the app,
    // especially during build when Redis might not be available.
    // You might decide if specific errors should still throw or exit,
    // but for build purposes, logging and continuing is often preferred.
  });

  redis.on('connect', () => {
    console.log('Connected to Redis successfully.');
  });

  redis.on('close', () => {
    console.log('Redis connection closed.');
  });

} else {
  console.warn('REDIS_URL is not defined. Redis client not initialized.');
  // Create a mock or no-op Redis client if your application expects `redis` to be defined
  // This prevents `redis.get()` etc. from failing if REDIS_URL is missing.
  // For simplicity here, we'll assign a basic object that won't do anything.
  // A more robust solution might involve a class that implements the Redis interface
  // with no-op methods.
  redis = {
    get: async () => null,
    set: async () => 'OK',
    setex: async () => 'OK',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    on: (_event: string, _callback: (..._args: unknown[]) => void) => {
      // No-op for 'error', 'connect', 'close' when not configured
      // if (_event === 'error' && _callback) { // Example of using them if logic was added
      //   _callback(new Error("Redis not configured"));
      // }
      return redis; // Return the redis mock itself for chaining
    },
    // Add other methods your app uses with no-op implementations
  } as Partial<Redis> as Redis; // Type assertion: first to Partial, then to Redis
}

export { redis };
