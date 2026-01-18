/**
 * RSS Service
 * Fetch, parse, and process RSS feeds
 * Production-ready with error handling
 */

import Parser from 'rss-parser';
import { RssSource, Article } from '../models';
import { LeanRssSource } from '../types';
import { logger } from '../utils/logger';
import {
    parseHtmlContent,
    cleanTitle,
    extractTags,
    estimateSkillLevel
} from '../utils/contentParser';

// Configure RSS parser
const parser = new Parser({
    timeout: 30000, // 30 second timeout
    headers: {
        'User-Agent': 'DevOci-Bot/1.0 (https://devoci.in)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
    },
    customFields: {
        item: [
            ['media:content', 'media'],
            ['media:thumbnail', 'thumbnail'],
            ['content:encoded', 'contentEncoded'],
        ],
    },
});

export interface FetchResult {
    success: boolean;
    articlesFound: number;
    articlesInserted: number;
    error?: string;
}

export interface ParsedArticle {
    title: string;
    description: string;
    url: string;
    imageUrl?: string;
    author?: string;
    publishedAt: Date;
    sourceId: string;
    sourceName: string;
    tags: string[];
    skillLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    targetRoles: { role: string; weight: number }[];
}

export const rssService = {
    /**
     * Fetch and process a single RSS source
     */
    async fetchSource(source: LeanRssSource): Promise<FetchResult> {
        const startTime = Date.now();

        try {
            logger.debug(`Fetching RSS: ${source.name} (${source.url})`);

            // Fetch and parse feed
            const feed = await parser.parseURL(source.url);

            if (!feed.items || feed.items.length === 0) {
                return { success: true, articlesFound: 0, articlesInserted: 0 };
            }

            // Process items
            const articles: ParsedArticle[] = [];

            for (const item of feed.items) {
                const article = this.parseItem(item, source);
                if (article) {
                    articles.push(article);
                }
            }

            // Deduplicate by URL
            const existingUrls = await this.getExistingUrls(
                articles.map(a => a.url)
            );

            const newArticles = articles.filter(
                a => !existingUrls.has(a.url)
            );

            // Bulk insert new articles
            let inserted = 0;
            if (newArticles.length > 0) {
                inserted = await this.insertArticles(newArticles);
            }

            // Update source metadata
            await this.updateSourceMetadata(source._id.toString(), {
                success: true,
                articlesProcessed: articles.length,
                articlesInserted: inserted,
            });

            const duration = Date.now() - startTime;
            logger.info(`RSS fetch complete: ${source.name}`, {
                found: articles.length,
                inserted,
                duration: `${duration}ms`,
            });

            return {
                success: true,
                articlesFound: articles.length,
                articlesInserted: inserted,
            };

        } catch (error) {
            const errMsg = error instanceof Error ? error.message : 'Unknown error';

            logger.error(`RSS fetch failed: ${source.name}`, { error: errMsg });

            // Update source with error
            await this.updateSourceMetadata(source._id.toString(), {
                success: false,
                error: errMsg,
            });

            return {
                success: false,
                articlesFound: 0,
                articlesInserted: 0,
                error: errMsg,
            };
        }
    },

    /**
     * Parse a single RSS item into article format
     */
    parseItem(
        item: Parser.Item,
        source: LeanRssSource
    ): ParsedArticle | null {
        // Validate required fields
        if (!item.link || !item.title) {
            return null;
        }

        // Clean title
        const title = cleanTitle(item.title);
        if (!title || title.length < 10) {
            return null; // Skip articles with no meaningful title
        }

        // Parse content for description and image
        const itemAny = item as Parser.Item & { contentEncoded?: string };
        const content = itemAny.contentEncoded || item.content || item.summary || '';
        const parsed = parseHtmlContent(content);

        // Get description (prefer parsed content over item description)
        const description = parsed.description ||
            item.contentSnippet ||
            item.summary ||
            '';

        // Find image
        const imageUrl = this.findItemImage(item, parsed.imageUrl);

        // Parse published date
        const publishedAt = item.pubDate
            ? new Date(item.pubDate)
            : new Date();

        // Skip very old articles (> 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        if (publishedAt < thirtyDaysAgo) {
            return null;
        }

        // Extract tags from content
        const contentTags = extractTags(title + ' ' + description, source.tags);

        // Estimate skill level
        const skillLevel = estimateSkillLevel(description, title);

        // Use source's target roles as default
        const targetRoles = source.targetRoles.map(role => ({
            role,
            weight: 0.5, // Default weight, AI will adjust later
        }));

        return {
            title,
            description,
            url: item.link,
            imageUrl,
            author: item.creator || (item as Parser.Item & { author?: string }).author,
            publishedAt,
            sourceId: source._id.toString(),
            sourceName: source.name,
            tags: contentTags,
            skillLevel,
            targetRoles,
        };
    },

    /**
     * Find best image from RSS item
     */
    findItemImage(item: Parser.Item, parsedImage?: string): string | undefined {
        // 1. Check enclosure (common in podcasts, some RSS)
        if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
            return item.enclosure.url;
        }

        // 2. Check media:content
        const media = (item as any).media;
        if (media?.$?.url) {
            return media.$.url;
        }

        // 3. Check media:thumbnail
        const thumbnail = (item as any).thumbnail;
        if (thumbnail?.$?.url) {
            return thumbnail.$.url;
        }

        // 4. Use image parsed from content
        if (parsedImage) {
            return parsedImage;
        }

        return undefined;
    },

    /**
     * Get existing URLs from database (for deduplication)
     */
    async getExistingUrls(urls: string[]): Promise<Set<string>> {
        const existing = await Article.find(
            { url: { $in: urls } },
            { url: 1 }
        ).lean();

        return new Set(existing.map(a => a.url));
    },

    /**
     * Insert articles in bulk
     */
    async insertArticles(articles: ParsedArticle[]): Promise<number> {
        if (articles.length === 0) return 0;

        try {
            // Prepare for insertion (with default values)
            const docs = articles.map(article => ({
                ...article,
                qualityScore: 5, // Default, AI will update
                isClickbait: false,
                views: 0,
                saves: 0,
                shares: 0,
                isActive: true,
            }));

            const result = await Article.insertMany(docs, {
                ordered: false,  // Continue on duplicate errors
            });

            return result.length;

        } catch (error: unknown) {
            // Handle bulk write errors (duplicates, etc.)
            const err = error as { insertedDocs?: unknown[] };
            if (err.insertedDocs) {
                return err.insertedDocs.length;
            }

            logger.error('Bulk insert failed', { error });
            return 0;
        }
    },

    /**
     * Update source metadata after fetch
     */
    async updateSourceMetadata(
        sourceId: string,
        result: {
            success: boolean;
            articlesProcessed?: number;
            articlesInserted?: number;
            error?: string;
        }
    ): Promise<void> {
        const now = new Date();

        if (result.success) {
            await RssSource.findByIdAndUpdate(sourceId, {
                lastFetchAt: now,
                nextFetchAt: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours
                consecutiveErrors: 0,
                $inc: {
                    articleCount: result.articlesInserted || 0
                },
            });
        } else {
            await RssSource.findByIdAndUpdate(sourceId, {
                lastFetchAt: now,
                lastError: result.error,
                $inc: {
                    errorCount: 1,
                    consecutiveErrors: 1,
                },
            });

            // Deactivate after 5 consecutive errors
            const source = await RssSource.findById(sourceId);
            if (source && source.consecutiveErrors >= 5) {
                source.isActive = false;
                await source.save();
                logger.warn(`Deactivated source after 5 errors: ${source.name}`);
            }
        }
    },

    /**
     * Get sources ready for fetching
     */
    async getSourcesForFetch(limit = 50): Promise<LeanRssSource[]> {
        const now = new Date();

        return await RssSource.find({
            isActive: true,
            $or: [
                { nextFetchAt: { $lte: now } },
                { nextFetchAt: { $exists: false } },
                { lastFetchAt: { $exists: false } },
            ],
        })
            .sort({ priority: -1, lastFetchAt: 1 })
            .limit(limit)
            .lean();
    },

    /**
     * Fetch all ready sources
     */
    async fetchAllSources(): Promise<{
        sourcesProcessed: number;
        totalArticles: number;
        totalInserted: number;
        errors: number;
    }> {
        const sources = await this.getSourcesForFetch();

        let totalArticles = 0;
        let totalInserted = 0;
        let errors = 0;

        for (const source of sources) {
            const result = await this.fetchSource(source);

            totalArticles += result.articlesFound;
            totalInserted += result.articlesInserted;
            if (!result.success) errors++;

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return {
            sourcesProcessed: sources.length,
            totalArticles,
            totalInserted,
            errors,
        };
    },
};
