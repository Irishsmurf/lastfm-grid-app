import Redis from 'ioredis';
import { logger } from '@/utils/logger';

const redis = new Redis(process.env.REDIS_URL as string);

redis.on('error', (err: Error) => {
  logger.error('Redis', `Connection error: ${err.message}`);
});

redis.on('reconnecting', () => {
  logger.warn('Redis', 'Reconnecting to Redis...');
});

export { redis };
