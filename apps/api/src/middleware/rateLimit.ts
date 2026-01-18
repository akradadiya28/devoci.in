/**
 * Rate Limiting Middleware
 * Redis-backed rate limiting for API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { cache } from '../db/redis';
import { logger } from '../utils/logger';

// Rate limit configuration
export interface RateLimitConfig {
    windowMs: number;      // Time window in ms
    maxRequests: number;   // Max requests per window
    keyPrefix?: string;    // Redis key prefix
    skipFailedRequests?: boolean;
    message?: string;
}

// Default configurations for different endpoints
export const rateLimits = {
    // General API - 100 req/min
    api: {
        windowMs: 60 * 1000,
        maxRequests: 100,
        keyPrefix: 'rl:api:',
    } as RateLimitConfig,

    // Auth endpoints - 10 req/min (stricter)
    auth: {
        windowMs: 60 * 1000,
        maxRequests: 10,
        keyPrefix: 'rl:auth:',
        message: 'Too many auth attempts. Please try again later.',
    } as RateLimitConfig,

    // GraphQL - 200 req/min
    graphql: {
        windowMs: 60 * 1000,
        maxRequests: 200,
        keyPrefix: 'rl:gql:',
    } as RateLimitConfig,

    // Upload/heavy operations - 10 req/min
    heavy: {
        windowMs: 60 * 1000,
        maxRequests: 10,
        keyPrefix: 'rl:heavy:',
    } as RateLimitConfig,

    // RSS fetch trigger - 5 req/hour
    rssFetch: {
        windowMs: 60 * 60 * 1000,
        maxRequests: 5,
        keyPrefix: 'rl:rss:',
    } as RateLimitConfig,
};

/**
 * Get client identifier (IP or user ID)
 */
function getClientKey(req: Request): string {
    // Prefer user ID if authenticated
    const userId = (req as any).user?.id;
    if (userId) {
        return `user:${userId}`;
    }

    // Fall back to IP
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
        ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
        : req.ip || req.socket.remoteAddress || 'unknown';

    return `ip:${ip}`;
}

/**
 * Create rate limiter middleware
 */
export function rateLimit(config: RateLimitConfig) {
    const {
        windowMs,
        maxRequests,
        keyPrefix = 'rl:',
        message = 'Too many requests. Please try again later.',
    } = config;

    const windowSeconds = Math.ceil(windowMs / 1000);

    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const clientKey = getClientKey(req);
            const redisKey = `${keyPrefix}${clientKey}`;

            // Get current count
            const current = await cache.get<number>(redisKey) || 0;

            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', maxRequests.toString());
            res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current - 1).toString());
            res.setHeader('X-RateLimit-Reset', (Date.now() + windowMs).toString());

            if (current >= maxRequests) {
                logger.warn('Rate limit exceeded', { clientKey, current, max: maxRequests });

                res.status(429).json({
                    error: 'TOO_MANY_REQUESTS',
                    message,
                    retryAfter: windowSeconds,
                });
                return;
            }

            // Increment counter
            await cache.set(redisKey, current + 1, windowSeconds);

            next();

        } catch (error) {
            // On Redis error, allow request (fail open)
            logger.error('Rate limit check failed', { error });
            next();
        }
    };
}

/**
 * Express middleware for GraphQL rate limiting
 * Uses operation-aware limiting
 */
export function graphqlRateLimit(config: RateLimitConfig = rateLimits.graphql) {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Check operation type from body
        const body = req.body;

        // Stricter limits for mutations
        let effectiveConfig = config;
        if (body?.query?.toLowerCase().includes('mutation')) {
            effectiveConfig = {
                ...config,
                maxRequests: Math.ceil(config.maxRequests / 2),
            };
        }

        return rateLimit(effectiveConfig)(req, res, next);
    };
}

/**
 * Sliding window rate limiter (more accurate)
 */
export async function checkRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const windowKey = `rl:sw:${key}`;

    try {
        // Get current count in window
        const current = await cache.get<number>(windowKey) || 0;

        if (current >= maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: now + (windowSeconds * 1000),
            };
        }

        // Increment
        await cache.set(windowKey, current + 1, windowSeconds);

        return {
            allowed: true,
            remaining: maxRequests - current - 1,
            resetAt: now + (windowSeconds * 1000),
        };

    } catch (error) {
        logger.error('Rate limit check failed', { error });
        // Fail open
        return {
            allowed: true,
            remaining: maxRequests,
            resetAt: now + (windowSeconds * 1000),
        };
    }
}

/**
 * Apply rate limiting to Apollo Server context
 */
export async function graphqlContextRateLimit(
    userId: string | null,
    ip: string,
    operationType: 'query' | 'mutation'
): Promise<void> {
    const key = userId ? `user:${userId}` : `ip:${ip}`;
    const config = rateLimits.graphql;

    // Stricter for mutations
    const limit = operationType === 'mutation'
        ? Math.ceil(config.maxRequests / 4)
        : config.maxRequests;

    const result = await checkRateLimit(key, limit, config.windowMs / 1000);

    if (!result.allowed) {
        throw new Error('Rate limit exceeded. Please try again later.');
    }
}
