import Redis from 'ioredis';
import { logger } from '@/utils/logger';

/**
 * Held on globalThis so dev HMR and separately-bundled route handlers reuse one
 * client instead of opening a new connection per module copy.
 */
const globalForRedis = globalThis as unknown as { __redis?: Redis };

function createClient(): Redis {
  const client = new Redis(process.env.REDIS_URL as string, {
    // Without this, importing this module opens a socket immediately — including
    // in build-time static generation workers that never issue a command, and in
    // every cold-started lambda whether or not the request touches Redis.
    lazyConnect: true,

    // Bounded so a slow or unreachable Redis surfaces quickly instead of holding
    // a request open. These are deliberately generous: handleCaching degrades to
    // an uncached fetch when a read fails, so a timeout costs latency, not a 500.
    connectTimeout: 3000,
    commandTimeout: 1500,
    maxRetriesPerRequest: 2,

    // Left enabled so commands issued during a brief reconnect are queued rather
    // than failing outright.
    enableOfflineQueue: true,
    keepAlive: 30000,

    retryStrategy: (times: number) => Math.min(times * 200, 2000),
  });

  client.on('error', (err: Error) => {
    logger.error('Redis', `Connection error: ${err.message}`);
  });

  client.on('reconnecting', () => {
    logger.warn('Redis', 'Reconnecting to Redis...');
  });

  return client;
}

const redis = globalForRedis.__redis ?? createClient();

if (!globalForRedis.__redis) {
  globalForRedis.__redis = redis;
}

export { redis };
