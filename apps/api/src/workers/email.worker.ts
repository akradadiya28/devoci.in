/**
 * Email Worker
 * Processes email jobs from queue
 */

import { emailQueue } from '../jobs';
import { emailService, TemplateData } from '../services/email';
import { User } from '../models';
import { trendingService } from '../services/trending';
import { logger } from '../utils/logger';

// Process send-email job
emailQueue.process('send-email', async (job) => {
    const { to, template, data } = job.data as {
        to: string;
        template: 'welcome' | 'verification' | 'passwordReset' | 'weeklyDigest' | 'newArticles';
        data: TemplateData;
    };

    logger.info(`[Email Worker] Sending ${template} to ${to}`);

    try {
        const result = await emailService.sendTemplate(to, template, data);
        return { success: result };

    } catch (error) {
        logger.error(`[Email Worker] Send failed:`, error);
        throw error;
    }
});

// Process weekly digest for all users
emailQueue.process('send-weekly-digest', async () => {
    logger.info('[Email Worker] Starting weekly digest distribution...');

    try {
        // Get users who opted in to digest
        const users = await User.find({
            'preferences.emailDigest': true,
            emailVerified: true,
        }).lean();

        if (users.length === 0) {
            return { sent: 0, message: 'No users opted in' };
        }

        // Get trending articles
        const trendingArticles = await trendingService.getTrending(7, 10);

        let sent = 0;
        let failed = 0;

        for (const user of users) {
            try {
                // Get personalized trending if possible
                const articles = trendingArticles.map(article => ({
                    title: article.title,
                    url: article.url,
                    description: article.description?.substring(0, 150) || '',
                }));

                await emailService.sendWeeklyDigest(
                    user.email,
                    user.name || 'Developer',
                    articles
                );

                sent++;

            } catch (error) {
                failed++;
                logger.error(`Failed to send digest to ${user.email}`, { error });
            }
        }

        logger.info(`[Email Worker] Weekly digest complete`, { sent, failed });

        return { sent, failed };

    } catch (error) {
        logger.error('[Email Worker] Weekly digest failed:', error);
        throw error;
    }
});

// Process welcome email
emailQueue.process('send-welcome', async (job) => {
    const { userId } = job.data as { userId: string };

    const user = await User.findById(userId).lean();
    if (!user) {
        return { success: false, error: 'User not found' };
    }

    const result = await emailService.sendWelcome(user.email, user.name || 'Developer');

    return { success: result };
});

export { emailQueue };
