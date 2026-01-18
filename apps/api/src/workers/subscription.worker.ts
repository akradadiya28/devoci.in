/**
 * Subscription Expiry Worker
 * Runs daily to revoke premium access for canceled/expired subscriptions
 */

import Queue, { Job } from 'bull';
import { User, StripeSubscription } from '../models';
import { emailService } from '../services/email';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

// Define Queue
export const subscriptionQueue = new Queue('subscription-expiry', config.redisUrl);

/**
 * Worker: Check and expire subscriptions
 * Runs every day at midnight
 */
subscriptionQueue.process('expire-subscriptions', async (_job: Job) => {
    logger.info('Starting subscription expiry check...');
    let expired = 0;
    let checked = 0;

    try {
        const now = new Date();

        // Find subscriptions where:
        // 1. Status is 'canceled' (user canceled but still has access)
        // 2. currentPeriodEnd has passed
        const subscriptionsToExpire = await StripeSubscription.find({
            status: 'canceled',
            currentPeriodEnd: { $lt: now },
        });

        for (const sub of subscriptionsToExpire) {
            checked++;

            try {
                // Update subscription status
                sub.status = 'ended';
                await sub.save();

                // Revoke user's premium access
                const user = await User.findById(sub.userId);
                if (user) {
                    user.plan = 'free';
                    user.isPremium = false;
                    user.currentSubscriptionStatus = 'none';
                    user.subscriptionEndDate = new Date();
                    await user.save();

                    // Send notification email
                    await emailService.sendTemplate(user.email, 'subscriptionCanceled', {
                        userName: user.name,
                    });

                    expired++;
                    logger.info(`Expired subscription for user ${user._id}`);
                }
            } catch (err) {
                logger.error(`Failed to expire subscription ${sub._id}`, err);
            }
        }

        // Also check for past_due subscriptions > 7 days
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const failedSubscriptions = await StripeSubscription.find({
            status: 'past_due',
            updatedAt: { $lt: sevenDaysAgo },
        });

        for (const sub of failedSubscriptions) {
            try {
                sub.status = 'ended';
                await sub.save();

                const user = await User.findById(sub.userId);
                if (user) {
                    user.plan = 'free';
                    user.isPremium = false;
                    user.currentSubscriptionStatus = 'none';
                    await user.save();

                    await emailService.sendTemplate(user.email, 'subscriptionCanceled', {
                        userName: user.name,
                    });

                    expired++;
                }
            } catch (err) {
                logger.error(`Failed to expire failed subscription ${sub._id}`, err);
            }
        }

        logger.info(`Subscription expiry complete: checked=${checked}, expired=${expired}`);
        return { checked, expired };

    } catch (error) {
        logger.error('Subscription expiry job failed', error);
        throw error;
    }
});

// Schedule: Daily at midnight UTC
subscriptionQueue.add(
    'expire-subscriptions',
    {},
    {
        repeat: { cron: '0 0 * * *' }, // Every day at 00:00 UTC
        removeOnComplete: true,
        removeOnFail: false,
    }
);

logger.info('Subscription expiry worker registered (daily at midnight)');
