
import { Notification, INotification } from '../models';
import { logger } from '../utils/logger';

export const notificationService = {
    /**
     * Create a notification
     */
    async create(
        userId: string,
        type: 'STREAK_RISK' | 'MILESTONE_UNLOCK' | 'SOCIAL_ENGAGEMENT' | 'SYSTEM',
        title: string,
        message: string,
        data: any = {}
    ): Promise<INotification> {
        try {
            const notification = await Notification.create({
                userId,
                type,
                title,
                message,
                data,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days retention
            });

            // TODO: In future, integrate with Push Notification (FCM/OneSignal) here

            // Real-Time Push
            try {
                // Dynamic import to avoid circular dependency
                const { realtimeService } = await import('./realtime.js');
                await realtimeService.sendNotification(userId, notification);
            } catch (err) {
                // ignore
            }

            return notification;
        } catch (error) {
            logger.error(`Error creating notification for user ${userId}:`, error);
            throw error;
        }
    },

    /**
     * Get user notifications
     */
    async getUserNotifications(userId: string, limit: number = 20, unreadOnly: boolean = false): Promise<INotification[]> {
        const query: any = { userId };
        if (unreadOnly) {
            query.isRead = false;
        }

        return Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(limit);
    },

    /**
     * Get unread count
     */
    async getUnreadCount(userId: string): Promise<number> {
        return Notification.countDocuments({ userId, isRead: false });
    },

    /**
     * Mark as read
     */
    async markAsRead(notificationId: string, userId: string): Promise<boolean> {
        const result = await Notification.updateOne(
            { _id: notificationId, userId },
            { isRead: true }
        );
        return result.modifiedCount > 0;
    },

    /**
     * Mark all as read
     */
    async markAllAsRead(userId: string): Promise<boolean> {
        await Notification.updateMany(
            { userId, isRead: false },
            { isRead: true }
        );
        return true;
    }
};
