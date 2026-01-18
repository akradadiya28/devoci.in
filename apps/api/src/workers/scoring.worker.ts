/**
 * AI Scoring Worker
 * Scores new articles using AI service
 */

import { scoringQueue } from '../jobs';
import { Article } from '../models';
import { aiService, AIScoreInput } from '../services/ai';
import { logger } from '../utils/logger';

// Process batch scoring job
scoringQueue.process('score-batch', async (job) => {
    const { limit = 50 } = job.data as { limit?: number };

    logger.info(`[AI Worker] Starting batch scoring (limit: ${limit})`);

    try {
        // Find articles without scores or with outdated scores
        const articles = await Article.find({
            $or: [
                { qualityScore: { $exists: false } },
                { qualityScore: 0 },
                { aiScored: { $ne: true } },
            ],
            isActive: true,
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        if (articles.length === 0) {
            return { processed: 0, message: 'No articles to score' };
        }

        logger.info(`[AI Worker] Scoring ${articles.length} articles`);

        // Prepare inputs
        const inputs: AIScoreInput[] = articles.map(article => ({
            title: article.title,
            description: article.description,
            content: article.content,
            url: article.url,
            sourceName: article.sourceName,
        }));

        // Score batch
        const results = await aiService.scoreBatch(inputs);

        // Update articles with scores
        let updated = 0;
        for (let i = 0; i < articles.length; i++) {
            const article = articles[i];
            const result = results[i];

            await Article.findByIdAndUpdate(article._id, {
                qualityScore: result.qualityScore,
                targetRoles: result.targetRoles,
                skillLevel: result.skillLevel,
                tags: result.tags,
                isClickbait: result.isClickbait,
                aiScored: true,
                aiScoredAt: new Date(),
            });

            updated++;
        }

        logger.info(`[AI Worker] Batch scoring complete`, { updated });

        return { processed: updated };

    } catch (error) {
        logger.error(`[AI Worker] Batch scoring failed:`, error);
        throw error;
    }
});

// Process single article scoring
scoringQueue.process('score-single', async (job) => {
    const { articleId } = job.data as { articleId: string };

    logger.info(`[AI Worker] Scoring article: ${articleId}`);

    try {
        const article = await Article.findById(articleId).lean();
        if (!article) {
            return { success: false, error: 'Article not found' };
        }

        const input: AIScoreInput = {
            title: article.title,
            description: article.description,
            content: article.content,
            url: article.url,
            sourceName: article.sourceName,
        };

        const result = await aiService.scoreArticle(input);

        await Article.findByIdAndUpdate(articleId, {
            qualityScore: result.qualityScore,
            targetRoles: result.targetRoles,
            skillLevel: result.skillLevel,
            tags: result.tags,
            isClickbait: result.isClickbait,
            aiScored: true,
            aiScoredAt: new Date(),
        });

        return { success: true, qualityScore: result.qualityScore };

    } catch (error) {
        logger.error(`[AI Worker] Single article scoring failed:`, error);
        throw error;
    }
});

export { scoringQueue };
