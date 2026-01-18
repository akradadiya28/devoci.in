/**
 * Trending Worker
 * Computes trending articles using gravity-based decay
 */

import { trendingQueue } from '../jobs';
import { trendingService } from '../services/trending';
import { logger } from '../utils/logger';

// Process compute-all job (scheduled every 1 hour)
trendingQueue.process('compute', async (job) => {
    logger.info(`[Trending Worker] Starting job ${job.id}`);

    try {
        const result = await trendingService.computeAllPeriods();

        logger.info(`[Trending Worker] Job ${job.id} completed`, result);

        return result;

    } catch (error) {
        logger.error(`[Trending Worker] Job ${job.id} failed:`, error);
        throw error;
    }
});

// Process role-specific trending
trendingQueue.process('compute-role', async (job) => {
    const { role, days = 7 } = job.data as { role: string; days?: number };

    logger.info(`[Trending Worker] Computing trending for role: ${role}`);

    try {
        const articles = await trendingService.getTrendingByRole(role, days);

        return { role, count: articles.length };

    } catch (error) {
        logger.error(`[Trending Worker] Role trending failed:`, error);
        throw error;
    }
});

// Process cache invalidation
trendingQueue.process('invalidate-cache', async () => {
    await trendingService.invalidateCache();
    return { success: true };
});

export { trendingQueue };
