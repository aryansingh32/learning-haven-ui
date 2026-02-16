import Redis from 'ioredis';
import dotenv from 'dotenv';
import logger from './logger';

dotenv.config();

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  logger.warn('REDIS_URL not found, Redis caching will be disabled or fail.');
}

const redis = new Redis(redisUrl || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error('Redis error', err);
});

export default redis;
