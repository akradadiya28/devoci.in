/**
 * Bull Job Queues
 * Background job processing for scale
 */

import Bull from 'bull';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

// Queue configuration
const queueOptions: Bull.QueueOptions = {
    redis: config.redisUrl,
    defaultJobOptions: {
        removeOnComplete: 100,  // Keep last 100 completed jobs
        removeOnFail: 500,      // Keep last 500 failed jobs
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,  // Start with 2s, then 4s, 8s...
        },
    },
};

// Job Queues
export const rssQueue = new Bull('rss-fetch', queueOptions);
export const scoringQueue = new Bull('article-scoring', queueOptions);
export const trendingQueue = new Bull('trending-compute', queueOptions);
export const roleQueue = new Bull('role-computation', queueOptions);
export const emailQueue = new Bull('email-send', queueOptions);
export const cleanupQueue = new Bull('cleanup', queueOptions);
export const weeklyStatsQueue = new Bull('weekly-stats', queueOptions);

// All queues for easy iteration
export const allQueues = [
    rssQueue,
    scoringQueue,
    trendingQueue,
    roleQueue,
    emailQueue,
    cleanupQueue,
    weeklyStatsQueue,
];

// Log queue events
allQueues.forEach((queue) => {
    queue.on('completed', (job) => {
        logger.debug(`Job ${job.id} completed in queue ${queue.name}`);
    });

    queue.on('failed', (job, err) => {
        logger.error(`Job ${job?.id} failed in queue ${queue.name}:`, err);
    });

    queue.on('stalled', (job) => {
        logger.warn(`Job ${job.id} stalled in queue ${queue.name}`);
    });
});

// Queue stats helper
export async function getQueueStats(): Promise<Record<string, unknown>> {
    const stats: Record<string, unknown> = {};

    for (const queue of allQueues) {
        const [waiting, active, completed, failed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
        ]);

        stats[queue.name] = { waiting, active, completed, failed };
    }

    return stats;
}

// Graceful shutdown
export async function closeAllQueues(): Promise<void> {
    await Promise.all(allQueues.map((queue) => queue.close()));
    logger.info('All job queues closed');
}

/**
 * Schedule recurring jobs
 */
export async function scheduleRecurringJobs(): Promise<void> {
    // RSS Fetch: Every 2 hours
    await rssQueue.add('fetch-all', {}, {
        repeat: { cron: '0 */2 * * *' },  // Every 2 hours
        jobId: 'recurring-rss-fetch',
    });

    // Trending: Every 1 hour
    await trendingQueue.add('compute', {}, {
        repeat: { cron: '0 * * * *' },  // Every hour
        jobId: 'recurring-trending',
    });

    // Role computation: Weekly (Sunday 2 AM)
    await roleQueue.add('compute-all', {}, {
        repeat: { cron: '0 2 * * 0' },  // Sunday 2 AM
        jobId: 'recurring-role-compute',
    });

    // Cleanup: Daily at 3 AM
    await cleanupQueue.add('cleanup-old', {}, {
        repeat: { cron: '0 3 * * *' },  // Daily 3 AM
        jobId: 'recurring-cleanup',
    });

    logger.info('Recurring jobs scheduled');
}
