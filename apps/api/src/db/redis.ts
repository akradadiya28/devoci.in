/**
 * Redis Connection & Cache Utility
 * Namespace pattern: namespace:object:id:param
 */

import Redis from 'ioredis';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

// Redis client singleton
let redis: Redis | null = null;

export function getRedis(): Redis {
    if (!redis) {
        redis = new Redis(config.redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            lazyConnect: true,
        });

        redis.on('connect', () => {
            logger.info('✅ Redis connected');
        });

        redis.on('error', (err) => {
            logger.error('Redis error:', err);
        });

        redis.on('close', () => {
            logger.warn('Redis connection closed');
        });
    }
    return redis;
}

export async function connectRedis(): Promise<Redis> {
    const client = getRedis();
    await client.connect();
    return client;
}

export async function disconnectRedis(): Promise<void> {
    if (redis) {
        await redis.quit();
        redis = null;
        logger.info('Redis connection closed');
    }
}

/**
 * Cache Utility with Namespace Pattern
 * Key format: namespace:object:id:param
 */
export const cache = {
    /**
     * Get cached value
     */
    async get<T>(key: string): Promise<T | null> {
        const client = getRedis();
        const data = await client.get(key);
        if (!data) return null;

        try {
            return JSON.parse(data) as T;
        } catch {
            return data as unknown as T;
        }
    },

    /**
     * Set cached value with TTL
     */
    async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
        const client = getRedis();
        const data = typeof value === 'string' ? value : JSON.stringify(value);
        await client.setex(key, ttlSeconds, data);
    },

    /**
     * Delete cached key
     */
    async del(key: string): Promise<void> {
        const client = getRedis();
        await client.del(key);
    },

    /**
     * Delete keys by pattern (e.g., feed:user:123:*)
     */
    async delPattern(pattern: string): Promise<number> {
        const client = getRedis();
        const keys = await client.keys(pattern);
        if (keys.length === 0) return 0;

        const deleted = await client.del(...keys);
        logger.debug(`Deleted ${deleted} cache keys matching: ${pattern}`);
        return deleted;
    },

    /**
     * Check if key exists
     */
    async exists(key: string): Promise<boolean> {
        const client = getRedis();
        return (await client.exists(key)) === 1;
    },

    /**
     * Get TTL of key
     */
    async ttl(key: string): Promise<number> {
        const client = getRedis();
        return client.ttl(key);
    },

    /**
     * Increment key
     */
    async incr(key: string): Promise<number> {
        const client = getRedis();
        return client.incr(key);
    },

    /**
     * Set expiration
     */
    async expire(key: string, seconds: number): Promise<number> {
        const client = getRedis();
        return client.expire(key, seconds);
    },
};

// Cache key builders (namespace:object:id:param)
export const cacheKeys = {
    // Feed cache: 5 min TTL
    userFeed: (userId: string, page: number) => `feed:user:${userId}:page:${page}`,

    // Article cache: 1 hour TTL
    article: (articleId: string) => `article:${articleId}:data`,

    // Trending cache: 10 min TTL
    trending: (days: number) => `trending:articles:${days}days`,

    // User profile cache: 30 min TTL
    userProfile: (userId: string) => `user:${userId}:profile`,

    // Session cache: 7 days TTL
    session: (sessionId: string) => `session:${sessionId}`,
};

// Cache TTLs in seconds
export const cacheTTL = {
    feed: 5 * 60,           // 5 minutes
    article: 60 * 60,       // 1 hour
    trending: 10 * 60,      // 10 minutes
    userProfile: 30 * 60,   // 30 minutes
    session: 7 * 24 * 60 * 60, // 7 days
};
