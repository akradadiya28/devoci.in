/**
 * Trending Service
 * Gravity-based trending score calculation
 * Formula: score = (views * 1 + saves * 3 + shares * 5) / (T + 2)^1.8
 */

import { Article } from '../models';
import { cache, cacheKeys, cacheTTL } from '../db/redis';
import { logger } from '../utils/logger';
import { FeedArticle } from '../types';

// Weights for engagement types
const WEIGHTS = {
    views: 1,
    saves: 3,
    shares: 5,
};

// Gravity constant (higher = faster decay)
const GRAVITY = 1.8;

export interface TrendingResult {
    articles: FeedArticle[];
    period: string;
    computedAt: Date;
}

export const trendingService = {
    /**
     * Calculate trending score using gravity algorithm
     * Hacker News style: score / (T + 2)^G
     */
    calculateScore(
        views: number,
        saves: number,
        shares: number,
        hoursOld: number
    ): number {
        const rawScore =
            (views * WEIGHTS.views) +
            (saves * WEIGHTS.saves) +
            (shares * WEIGHTS.shares);

        // Apply time decay (gravity)
        const timePenalty = Math.pow(hoursOld + 2, GRAVITY);

        return rawScore / timePenalty;
    },

    /**
     * Compute trending articles for a given time period
     */
    async computeTrending(
        days: number = 7,
        limit: number = 50
    ): Promise<FeedArticle[]> {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        logger.info(`Computing trending for last ${days} days...`);

        // Get articles from the period with their scores
        const articles = await Article.aggregate([
            // Match articles from the period
            {
                $match: {
                    publishedAt: { $gte: since },
                    isActive: true,
                    qualityScore: { $gte: 5 }, // Minimum quality
                },
            },
            // Calculate hours old
            {
                $addFields: {
                    hoursOld: {
                        $divide: [
                            { $subtract: [new Date(), '$publishedAt'] },
                            1000 * 60 * 60, // milliseconds to hours
                        ],
                    },
                },
            },
            // Calculate raw engagement score
            {
                $addFields: {
                    rawScore: {
                        $add: [
                            { $multiply: ['$views', WEIGHTS.views] },
                            { $multiply: ['$saves', WEIGHTS.saves] },
                            { $multiply: ['$shares', WEIGHTS.shares] },
                        ],
                    },
                },
            },
            // Calculate trending score with gravity decay
            {
                $addFields: {
                    trendingScore: {
                        $divide: [
                            '$rawScore',
                            { $pow: [{ $add: ['$hoursOld', 2] }, GRAVITY] },
                        ],
                    },
                },
            },
            // Sort by trending score
            { $sort: { trendingScore: -1 } },
            // Limit results
            { $limit: limit },
            // Project only needed fields
            {
                $project: {
                    title: 1,
                    description: 1,
                    url: 1,
                    imageUrl: 1,
                    sourceName: 1,
                    publishedAt: 1,
                    qualityScore: 1,
                    targetRoles: 1,
                    skillLevel: 1,
                    tags: 1,
                    views: 1,
                    saves: 1,
                    trendingScore: 1,
                },
            },
        ]);

        logger.info(`Found ${articles.length} trending articles`);

        return articles as FeedArticle[];
    },

    /**
     * Get trending with caching
     */
    async getTrending(days: number = 7, limit: number = 20): Promise<FeedArticle[]> {
        const cacheKey = cacheKeys.trending(days);

        // Check cache
        const cached = await cache.get<FeedArticle[]>(cacheKey);
        if (cached) {
            logger.debug(`Trending cache hit: ${cacheKey}`);
            return cached.slice(0, limit);
        }

        // Compute fresh
        const articles = await this.computeTrending(days, limit);

        // Cache result
        await cache.set(cacheKey, articles, cacheTTL.trending);

        return articles;
    },

    /**
     * Compute trending for multiple periods and cache all
     */
    async computeAllPeriods(): Promise<{
        daily: number;
        weekly: number;
        monthly: number;
    }> {
        const periods = [
            { days: 1, name: 'daily' },
            { days: 7, name: 'weekly' },
            { days: 30, name: 'monthly' },
        ];

        const results: Record<string, number> = {};

        for (const period of periods) {
            const articles = await this.computeTrending(period.days, 50);

            // Cache with appropriate TTL
            const cacheKey = cacheKeys.trending(period.days);
            await cache.set(cacheKey, articles, cacheTTL.trending);

            results[period.name] = articles.length;
            logger.info(`Cached ${articles.length} trending for ${period.name}`);
        }

        return {
            daily: results.daily || 0,
            weekly: results.weekly || 0,
            monthly: results.monthly || 0,
        };
    },

    /**
     * Get trending by role
     */
    async getTrendingByRole(
        role: string,
        days: number = 7,
        limit: number = 20
    ): Promise<FeedArticle[]> {
        const cacheKey = `trending:role:${role}:${days}`;

        // Check cache
        const cached = await cache.get<FeedArticle[]>(cacheKey);
        if (cached) {
            return cached.slice(0, limit);
        }

        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const articles = await Article.aggregate([
            {
                $match: {
                    publishedAt: { $gte: since },
                    isActive: true,
                    qualityScore: { $gte: 5 },
                    'targetRoles.role': role,
                },
            },
            {
                $addFields: {
                    hoursOld: {
                        $divide: [
                            { $subtract: [new Date(), '$publishedAt'] },
                            1000 * 60 * 60,
                        ],
                    },
                },
            },
            {
                $addFields: {
                    rawScore: {
                        $add: [
                            { $multiply: ['$views', WEIGHTS.views] },
                            { $multiply: ['$saves', WEIGHTS.saves] },
                            { $multiply: ['$shares', WEIGHTS.shares] },
                        ],
                    },
                },
            },
            {
                $addFields: {
                    trendingScore: {
                        $divide: [
                            '$rawScore',
                            { $pow: [{ $add: ['$hoursOld', 2] }, GRAVITY] },
                        ],
                    },
                },
            },
            { $sort: { trendingScore: -1 } },
            { $limit: limit },
            {
                $project: {
                    title: 1,
                    description: 1,
                    url: 1,
                    imageUrl: 1,
                    sourceName: 1,
                    publishedAt: 1,
                    qualityScore: 1,
                    targetRoles: 1,
                    skillLevel: 1,
                    tags: 1,
                    views: 1,
                    saves: 1,
                    trendingScore: 1,
                },
            },
        ]);

        // Cache for 30 minutes
        await cache.set(cacheKey, articles, 30 * 60);

        return articles as FeedArticle[];
    },

    /**
     * Invalidate trending cache
     */
    async invalidateCache(): Promise<void> {
        await cache.delPattern('trending:*');
        logger.info('Trending cache invalidated');
    },
};
