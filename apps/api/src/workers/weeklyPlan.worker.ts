
import Queue, { Job } from 'bull';
import { User } from '../models';
import { weeklyPlanService } from '../services/weeklyPlan';
import { emailService } from '../services/email';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

// Define Queue
export const weeklyPlanQueue = new Queue('weekly-plan-generation', config.redisUrl);

/**
 * Worker: Generate Weekly Plans
 * Runs every Sunday at 9 AM
 */
weeklyPlanQueue.process('generate-all-plans', async (_job: Job) => {
    logger.info('Starting weekly plan generation job...');
    let generated = 0;
    let failed = 0;

    try {
        // 1. Find Premium Users
        const cursor = User.find({
            // plan: 'premium' // Uncomment when payments live
            isPremium: true // Temporary check
        }).cursor();

        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            try {
                // 2. Generate Plan
                const plan = await weeklyPlanService.generatePlan(doc._id.toString());

                if (plan) {
                    // 3. Notify User
                    await emailService.sendTemplate(doc.email, 'newArticles', {
                        userName: doc.name,
                        articles: plan.articles.slice(0, 3).map((_a: any) => ({
                            title: 'Your Weekly Plan Article', // Need to fetch details, simplified for now
                            url: `https://devoci.in/plan/${plan._id}`,
                            description: 'View your new weekly learning plan.'
                        }))
                    });
                    generated++;
                }
            } catch (err) {
                logger.error(`Failed to generate plan for ${doc._id}`, err);
                failed++;
            }
        }

        logger.info(`Weekly plan generation complete. Generated: ${generated}, Failed: ${failed}`);
        return { generated, failed };

    } catch (error) {
        logger.error('Fatal error in weekly plan worker', error);
        throw error;
    }
});

// Schedule the recurring job (if not already scheduled)
weeklyPlanQueue.add(
    'generate-all-plans',
    {},
    {
        repeat: { cron: '0 9 * * 0' } // Every Sunday at 9 AM
    }
);
