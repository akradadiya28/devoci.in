
import Queue from 'bull';
import { User, UserStreak, Notification } from '../models';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { notificationService } from '../services';

const engagementReminderQueue = new Queue('engagement-reminder', config.redisUrl);

/**
 * Process Engagement Reminders
 * Logic:
 * 1. Find users who read YESTERDAY but not TODAY
 * 2. Send "Don't break your streak!" notification
 */
engagementReminderQueue.process('check-streaks', async (_job) => {
    logger.info('Starting daily engagement reminder job...');

    try {
        // Find active users
        const activeUsersCount = await User.countDocuments({ isActive: true });
        logger.info(`Checking streaks for ${activeUsersCount} users...`);

        // Find users with streaks > 0 who haven't read today
        // Last read date < today start
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);

        // Find users whose last read date is YESTERDAY (meaning they are at risk today)
        const atRiskStreaks = await UserStreak.find({
            lastReadDate: {
                $gte: yesterdayStart,
                $lt: todayStart
            },
            currentStreakCount: { $gt: 0 }
        });

        logger.info(`Found ${atRiskStreaks.length} users at risk of breaking streak.`);

        for (const streak of atRiskStreaks) {
            // Check if we already sent a reminder today?
            // For now, let's assume the job runs once heavily or we check Notification existence
            // Ideally: Notification.exists({ userId, type: 'STREAK_RISK', createdAt: { $gte: todayStart } })

            const exists = await Notification.exists({
                userId: streak.userId,
                type: 'STREAK_RISK',
                createdAt: { $gte: todayStart }
            });

            if (!exists) {
                await notificationService.create(
                    streak.userId.toString(),
                    'STREAK_RISK',
                    '🔥 Streak at Risk!',
                    `You're on a ${streak.currentStreakCount}-day streak. Read an article to keep it alive!`,
                    { streakCount: streak.currentStreakCount }
                );
                logger.debug(`Sent reminder to user ${streak.userId}`);
            }
        }

        logger.info('Daily engagement reminder job completed.');
    } catch (error) {
        logger.error('Error in engagement reminder job:', error);
        throw error;
    }
});

// Schedule: Runs daily at 6 PM
// For now, we manually trigger or schedule in main index
// engagementReminderQueue.add('check-streaks', {}, { repeat: { cron: '0 18 * * *' } });

export { engagementReminderQueue };
