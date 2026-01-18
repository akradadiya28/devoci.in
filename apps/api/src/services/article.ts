/**
 * Article Service
 * Business logic for articles with caching
 * Production-ready with proper types
 */

import { Article } from '../models';
import { cache, cacheKeys, cacheTTL } from '../db/redis';
import { logger } from '../utils/logger';
import { LeanArticle, FeedArticle } from '../types';

interface ArticleFilters {
    roles?: string[];
    tags?: string[];
    skillLevel?: string;
    minQuality?: number;
    limit?: number;
    cursor?: string;  // Cursor-based pagination (not offset!)
}

export const articleService = {
    /**
     * Get articles with cursor-based pagination
     * Per backend.md: Cursor > Offset for scale
     */
    async getArticles(filters: ArticleFilters = {}): Promise<FeedArticle[]> {
        const {
            roles,
            tags,
            skillLevel,
            minQuality = 7,
            limit = 20,
            cursor,
        } = filters;

        // Build query
        const query: Record<string, unknown> = {
            qualityScore: { $gte: minQuality },
            isActive: true,
            isClickbait: false,
        };

        // Role filtering
        if (roles?.length) {
            query['targetRoles.role'] = { $in: roles };
        }

        // Tag filtering
        if (tags?.length) {
            query.tags = { $in: tags };
        }

        // Skill level
        if (skillLevel) {
            query.skillLevel = skillLevel;
        }

        // Cursor-based pagination (efficient for scale)
        if (cursor) {
            query._id = { $lt: cursor };
        }

        // Execute query with projection (per backend.md - select only needed fields)
        const articles = await Article.find(query)
            .select({
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
            })
            .sort({ _id: -1 })  // Most recent first
            .limit(limit)
            .lean<FeedArticle[]>();

        return articles;
    },

    /**
     * Get single article by ID (with caching)
     */
    async getById(articleId: string): Promise<LeanArticle | null> {
        // Check cache
        const cacheKey = cacheKeys.article(articleId);
        const cached = await cache.get<LeanArticle>(cacheKey);
        if (cached) return cached;

        // Fetch from DB
        const article = await Article.findById(articleId).lean<LeanArticle>();
        if (article) {
            await cache.set(cacheKey, article, cacheTTL.article);
        }

        return article;
    },

    /**
     * Increment views
     */
    async incrementViews(articleId: string): Promise<void> {
        await Article.findByIdAndUpdate(articleId, { $inc: { views: 1 } });
        // Invalidate cache
        await cache.del(cacheKeys.article(articleId));
    },

    /**
     * Toggle save (increment/decrement)
     */
    async toggleSave(articleId: string, save: boolean): Promise<void> {
        const update = save ? { $inc: { saves: 1 } } : { $inc: { saves: -1 } };
        await Article.findByIdAndUpdate(articleId, update);
        await cache.del(cacheKeys.article(articleId));
    },

    /**
     * Check if URL exists (for deduplication)
     */
    async existsByUrl(url: string): Promise<boolean> {
        const count = await Article.countDocuments({ url });
        return count > 0;
    },

    /**
     * Bulk insert articles (for RSS ingestion)
     * Per backend.md: Use bulk operations for scale
     */
    async bulkInsert(articles: Partial<LeanArticle>[]): Promise<number> {
        if (articles.length === 0) return 0;

        try {
            const result = await Article.insertMany(articles, { ordered: false });
            logger.info(`Bulk inserted ${result.length} articles`);
            return result.length;
        } catch (error: unknown) {
            // Handle duplicate key errors
            const err = error as { insertedDocs?: unknown[] };
            if (err.insertedDocs) {
                const inserted = err.insertedDocs.length;
                logger.warn(`Bulk insert: ${inserted} inserted, some duplicates skipped`);
                return inserted;
            }
            throw error;
        }
    },
};
