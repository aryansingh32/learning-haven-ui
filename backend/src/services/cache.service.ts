import redis from '../config/redis';
import logger from '../config/logger';

export class CacheService {
    /**
     * Get cached data
     */
    static async get<T>(key: string): Promise<T | null> {
        try {
            const data = await redis.get(key);
            if (!data) return null;
            return JSON.parse(data) as T;
        } catch (error) {
            logger.error('Cache get error:', { key, error });
            return null;
        }
    }

    /**
     * Set cached data with TTL (in seconds)
     */
    static async set(key: string, value: any, ttl: number = 3600): Promise<void> {
        try {
            await redis.setex(key, ttl, JSON.stringify(value));
        } catch (error) {
            logger.error('Cache set error:', { key, error });
        }
    }

    /**
     * Delete cached data
     */
    static async del(key: string): Promise<void> {
        try {
            await redis.del(key);
        } catch (error) {
            logger.error('Cache delete error:', { key, error });
        }
    }

    /**
     * Delete multiple keys matching pattern
     */
    static async delPattern(pattern: string): Promise<void> {
        try {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } catch (error) {
            logger.error('Cache delete pattern error:', { pattern, error });
        }
    }

    /**
     * Check if key exists
     */
    static async exists(key: string): Promise<boolean> {
        try {
            const result = await redis.exists(key);
            return result === 1;
        } catch (error) {
            logger.error('Cache exists error:', { key, error });
            return false;
        }
    }
}
