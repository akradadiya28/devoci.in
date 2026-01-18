/**
 * Engagement Service
 * Handles user interactions (view, save, share)
 * Integrates with Gamification Service
 */

import { Engagement, Article } from '../models';
import { gamificationService } from './gamification';
import { logger } from '../utils/logger';

export const engagementService = {
    /**
     * Record article view
     * Updates interaction stats and checking streak
     */
    async viewArticle(userId: string, articleId: string): Promise<boolean> {
        try {
            // 1. Create/Update Engagement record
            // We use upsert to avoid duplicate views spamming stats immediately?
            // Or just insert every view? Spec says "Create/update Engagement record".
            // Typically we want one record per user/article/type to avoid spam.

            await Engagement.findOneAndUpdate(
                { userId, articleId, type: 'VIEW' },
                {
                    $setOnInsert: { createdAt: new Date() },
                    $set: { updatedAt: new Date() } // Update timestamp
                },
                { upsert: true, new: true }
            );

            // 2. Increment Article view count (atomic)
            await Article.findByIdAndUpdate(articleId, { $inc: { views: 1 } });

            // 3. Check Streak (Gamification)
            // Fire and forget? Or await? Await is safer for now.
            const streakResult = await gamificationService.checkStreak(userId);

            logger.info(`User ${userId} viewed article ${articleId}. Streak: ${streakResult.streakCount}`);

            // Gamification: Pulse Streak & Milestones
            await gamificationService.checkReadingMilestones(userId); // Check for 10/50/100 articles

            return true;
        } catch (error) {
            logger.error(`Error viewing article:`, error);
            throw error;
        }
    },

    /**
     * Save article (Bookmark)
     */
    async saveArticle(userId: string, articleId: string): Promise<boolean> {
        // Implementation for bookmarking (SavedArticles)
        logger.info(`User ${userId} saved article ${articleId}`);
        // TODO: Implement SavedArticle logic

        // Gamification
        await gamificationService.checkEngagementMilestones(userId, 'SAVE');

        return true;
    },

    /**
     * Share article
     */
    async shareArticle(userId: string, articleId: string, platform: string): Promise<boolean> {
        // Log share
        await Engagement.create({
            userId,
            articleId,
            type: 'SHARE',
            // platform is not in Engagement model yet, maybe add to metadata or ignore for now
            // But we can log it
        });

        logger.info(`User ${userId} shared article ${articleId} on ${platform}`);

        // Gamification
        await gamificationService.checkEngagementMilestones(userId, 'SHARE');

        return true;
    }
};
