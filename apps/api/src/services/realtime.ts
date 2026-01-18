
import { Redis } from 'ioredis';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

// Create a dedicated publisher connection
// (Do not reuse the subscriber or blocking connection)
const redisPub = new Redis(config.redisUrl);

export const realtimeService = {
    /**
     * Publish event to Real-Time Server via Redis
     */
    async publish(channel: string, payload: { userId?: string; type: string; data: any }) {
        try {
            const message = JSON.stringify(payload);
            await redisPub.publish(channel, message);
            logger.debug(`Published event to ${channel}`, { type: payload.type, userId: payload.userId });
        } catch (error) {
            logger.error(`Failed to publish realtime event to ${channel}:`, error);
        }
    },

    /**
     * Helpers for specific events
     */
    async sendNotification(userId: string, notification: any) {
        await this.publish('events:notification', {
            userId,
            type: 'new_notification',
            data: notification
        });
    },

    async sendStreakUpdate(userId: string, requestedData: any) {
        await this.publish('events:streak', {
            userId,
            type: 'streak_updated',
            data: requestedData
        });
    },

    async sendMilestoneUnlock(userId: string, milestone: any) {
        await this.publish('events:milestone', {
            userId,
            type: 'milestone_unlocked',
            data: milestone
        });
    }
};
