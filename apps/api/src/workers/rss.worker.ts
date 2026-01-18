/**
 * RSS Worker
 * Fetches articles from dynamic RSS sources
 * Production-ready implementation
 */

import { rssQueue } from '../jobs';
import { rssService } from '../services/rss';
import { logger } from '../utils/logger';

// Process RSS fetch-all jobs (scheduled every 2 hours)
rssQueue.process('fetch-all', async (job) => {
    logger.info(`[RSS Worker] Starting job ${job.id}`);

    try {
        const result = await rssService.fetchAllSources();

        logger.info(`[RSS Worker] Job ${job.id} completed`, result);

        return result;

    } catch (error) {
        logger.error(`[RSS Worker] Job ${job.id} failed:`, error);
        throw error;
    }
});

// Process single source fetch (for manual triggers)
rssQueue.process('fetch-source', async (job) => {
    const { sourceId } = job.data as { sourceId: string };

    logger.info(`[RSS Worker] Fetching single source: ${sourceId}`);

    try {
        const source = await rssService.getSourcesForFetch(1);

        if (source.length === 0) {
            return { success: false, error: 'Source not found or not ready' };
        }

        const result = await rssService.fetchSource(source[0]);

        logger.info(`[RSS Worker] Single source fetch complete`, result);

        return result;

    } catch (error) {
        logger.error(`[RSS Worker] Single source fetch failed:`, error);
        throw error;
    }
});

export { rssQueue };
