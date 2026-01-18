/**
 * Per-User Rate Limiting Middleware
 * Different limits based on user plan (free vs premium)
 */

import { Request, Response, NextFunction } from 'express';
import { cache } from '../db/redis';
import { logger } from '../utils/logger';

interface RateLimitConfig {
    windowMs: number;       // Time window in milliseconds
    maxRequests: number;    // Max requests per window
    message?: string;       // Error message
}

// Rate limit configurations by plan
const RATE_LIMITS: Record<string, RateLimitConfig> = {
    anonymous: {
        windowMs: 60 * 1000,    // 1 minute
        maxRequests: 30,         // 30 requests
        message: 'Too many requests. Please try again later.',
    },
    free: {
        windowMs: 60 * 1000,    // 1 minute
        maxRequests: 100,        // 100 requests
        message: 'Rate limit exceeded. Upgrade to premium for higher limits.',
    },
    premium: {
        windowMs: 60 * 1000,    // 1 minute
        maxRequests: 500,        // 500 requests
        message: 'Rate limit exceeded. Please slow down.',
    },
    admin: {
        windowMs: 60 * 1000,    // 1 minute
        maxRequests: 1000,       // 1000 requests
        message: 'Admin rate limit exceeded.',
    },
};

// Endpoint-specific limits (for sensitive operations)
const ENDPOINT_LIMITS: Record<string, RateLimitConfig> = {
    'signup': {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 5,            // 5 signups per hour per IP
        message: 'Too many signup attempts. Please try again later.',
    },
    'login': {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 10,           // 10 login attempts
        message: 'Too many login attempts. Please try again later.',
    },
    'requestPasswordReset': {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 3,            // 3 reset requests per hour
        message: 'Too many password reset requests.',
    },
};

// Check rate limit using Redis
async function checkRateLimit(
    key: string,
    config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();

    try {
        const current = await cache.incr(key);

        // Set expiry on first request
        if (current === 1) {
            await cache.expire(key, Math.ceil(config.windowMs / 1000));
        }

        if (current > config.maxRequests) {
            const ttl = await cache.ttl(key);
            return {
                allowed: false,
                remaining: 0,
                resetAt: now + (ttl > 0 ? ttl * 1000 : config.windowMs),
            };
        }

        return {
            allowed: true,
            remaining: config.maxRequests - current,
            resetAt: now + config.windowMs,
        };
    } catch (error) {
        // Fail open on Redis error
        logger.error('Rate limit check failed:', error);
        return { allowed: true, remaining: config.maxRequests, resetAt: now };
    }
}

// Extract user info from request
function getUserInfo(req: Request): { id: string; plan: string; isAdmin: boolean } {
    const user = (req as any).user;
    if (!user) {
        return { id: req.ip || 'unknown', plan: 'anonymous', isAdmin: false };
    }
    return {
        id: user._id?.toString() || user.userId || req.ip || 'unknown',
        plan: user.plan || 'free',
        isAdmin: user.isAdmin || false,
    };
}

// Extract operation name from GraphQL request
function getOperationName(req: Request): string | null {
    if (req.body?.operationName) {
        return req.body.operationName;
    }
    const query = req.body?.query || '';
    const match = query.match(/(?:mutation|query)\s+(\w+)/);
    return match ? match[1] : null;
}

/**
 * User-based rate limiting middleware
 */
export function userRateLimiter() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const userInfo = getUserInfo(req);
        const plan = userInfo.isAdmin ? 'admin' : userInfo.plan;
        const config = RATE_LIMITS[plan] || RATE_LIMITS.anonymous;

        const key = `ratelimit:user:${userInfo.id}`;
        const result = await checkRateLimit(key, config);

        res.setHeader('X-RateLimit-Limit', config.maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

        if (!result.allowed) {
            logger.warn(`Rate limit exceeded for ${plan} user: ${userInfo.id}`);
            res.status(429).json({
                errors: [{
                    message: config.message,
                    extensions: { code: 'RATE_LIMITED', resetAt: result.resetAt },
                }],
            });
            return;
        }

        next();
    };
}

/**
 * Endpoint-specific rate limiting (for sensitive operations)
 */
export function endpointRateLimiter() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const operationName = getOperationName(req);

        if (!operationName || !ENDPOINT_LIMITS[operationName]) {
            return next();
        }

        const config = ENDPOINT_LIMITS[operationName];
        const userInfo = getUserInfo(req);
        const key = `ratelimit:endpoint:${operationName}:${userInfo.id}`;

        const result = await checkRateLimit(key, config);

        if (!result.allowed) {
            logger.warn(`Endpoint rate limit: ${operationName} for ${userInfo.id}`);
            res.status(429).json({
                errors: [{
                    message: config.message,
                    extensions: { code: 'RATE_LIMITED', operation: operationName },
                }],
            });
            return;
        }

        next();
    };
}

/**
 * Legacy rate limiter (backward compatible)
 */
export const rateLimiter = (limit: number = 100, windowSeconds: number = 60) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const ip = req.ip || req.socket.remoteAddress || 'unknown';
            const key = `ratelimit:ip:${ip}`;

            const current = await cache.incr(key);
            if (current === 1) {
                await cache.expire(key, windowSeconds);
            }

            if (current > limit) {
                logger.warn(`Rate limit exceeded for IP: ${ip}`);
                res.status(429).json({ error: 'Too many requests', retryAfter: windowSeconds });
                return;
            }

            res.setHeader('X-RateLimit-Limit', limit);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));

            next();
        } catch (error) {
            logger.error('Rate limiter error:', error);
            next();
        }
    };
};
