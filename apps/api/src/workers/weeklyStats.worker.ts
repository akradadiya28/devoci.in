import { Job } from 'bull';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { User, Engagement, WeeklyStats } from '../models';
import { weeklyStatsQueue } from '../jobs';

// Define the job data interface
interface WeeklyStatsJob {
    weekStart?: string; // Date strings when passed via Redis
    weekEnd?: string;
}

/**
 * Process function for Weekly Stats
 */
const processWeeklyStats = async (job: Job<WeeklyStatsJob>) => {
    logger.info(`Processing weekly stats job ${job.id}`);

    try {
        // 1. Determine Week Boundaries
        let weekStart: Date;
        let weekEnd: Date;

        if (job.data.weekStart) {
            weekStart = new Date(job.data.weekStart);
        } else {
            const d = new Date();
            const day = d.getDay(); // 0 is Sunday
            // If we are running on Sunday night (23:59), we want THIS week.
            // If we are running Monday morning, we want LAST week.
            // The schedule in jobs/index.ts is "59 23 * * 0" (Sunday 23:59).
            // So we want the week ending today.
            // Monday of this week:
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            weekStart = new Date(d.setDate(diff));
            weekStart.setHours(0, 0, 0, 0);
        }

        if (job.data.weekEnd) {
            weekEnd = new Date(job.data.weekEnd);
        } else {
            // End of this Sunday
            weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
        }

        logger.info(`Computing stats for window: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);

        // 2. Get all users
        const users = await User.find({ isEmailVerified: true }).select('_id preferences');
        logger.info(`Found ${users.length} users to process.`);

        let processedCount = 0;
        for (const user of users) {
            try {
                await processUserStats(user, weekStart, weekEnd);
                processedCount++;
            } catch (err) {
                logger.error(`Failed to process stats for user ${user._id}:`, err);
            }
        }

        logger.info(`Weekly stats aggregation complete. Processed ${processedCount} users.`);

    } catch (error) {
        logger.error('Error in weekly stats worker:', error);
        throw error;
    }
};

/**
 * Process stats for a single user
 */
async function processUserStats(user: any, weekStart: Date, weekEnd: Date) {
    const userId = user._id;

    // A. Aggregate Engagements
    const stats = await Engagement.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId.toString()),
                createdAt: { $gte: weekStart, $lte: weekEnd },
                type: 'VIEW'
            }
        },
        {
            $group: {
                _id: null,
                totalArticles: { $sum: 1 },
                totalTime: { $sum: { $ifNull: ["$timeSpent", 300] } },
            }
        }
    ]);

    const data = stats[0] || { totalArticles: 0, totalTime: 0 };

    // B. Count Shares/Saves
    const shares = await Engagement.countDocuments({
        userId,
        type: 'SHARE',
        createdAt: { $gte: weekStart, $lte: weekEnd }
    });

    const saves = await Engagement.countDocuments({
        userId,
        type: 'SAVE',
        createdAt: { $gte: weekStart, $lte: weekEnd }
    });

    // C. Calculate Engagement Score
    let score = (data.totalArticles * 5) + (shares * 20) + (saves * 10);
    score = Math.min(score, 100);

    // Week Info
    const oneJan = new Date(weekStart.getFullYear(), 0, 1);
    const numberOfDays = Math.floor((weekStart.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7);

    // D. Upsert WeeklyStats
    await WeeklyStats.findOneAndUpdate(
        { userId, year: weekStart.getFullYear(), weekNumber },
        {
            weekStart,
            weekEnd,
            articlesRead: data.totalArticles,
            readingDays: data.totalArticles > 0 ? 1 : 0, // Placeholder
            totalReadingTime: data.totalTime,
            articlesShared: shares,
            articlesSaved: saves,
            engagementScore: score,
            updatedAt: new Date()
        },
        { upsert: true }
    );
}

// Attach to queue
weeklyStatsQueue.process('compute-weekly-stats', processWeeklyStats);
logger.info('Weekly Stats worker initialized');

export { weeklyStatsQueue };
