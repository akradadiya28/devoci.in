/**
 * Push Notification Service
 * Handles Web Push notifications using web-push library
 */

import webPush from 'web-push';
import { PushSubscription } from '../models/PushSubscription';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

// Initialize web-push with VAPID keys (if configured)
if (config.vapidPublicKey && config.vapidPrivateKey) {
    webPush.setVapidDetails(
        `mailto:${config.emailFrom.replace(/<|>/g, '').split(' ').pop()}`,
        config.vapidPublicKey,
        config.vapidPrivateKey
    );
    logger.info('📲 Push notifications: Configured');
} else {
    logger.warn('📲 Push notifications: VAPID keys not configured');
}

export interface PushPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
    data?: Record<string, any>;
}

export const pushService = {
    /**
     * Check if push notifications are configured
     */
    isConfigured(): boolean {
        return !!(config.vapidPublicKey && config.vapidPrivateKey);
    },

    /**
     * Get VAPID public key (for frontend)
     */
    getPublicKey(): string | null {
        return config.vapidPublicKey || null;
    },

    /**
     * Subscribe user to push notifications
     */
    async subscribe(
        userId: string,
        subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
        userAgent?: string
    ): Promise<boolean> {
        try {
            // Upsert subscription
            await PushSubscription.findOneAndUpdate(
                { endpoint: subscription.endpoint },
                {
                    userId,
                    endpoint: subscription.endpoint,
                    keys: subscription.keys,
                    userAgent,
                },
                { upsert: true, new: true }
            );

            logger.info(`Push subscription added for user: ${userId}`);
            return true;
        } catch (error) {
            logger.error('Failed to save push subscription:', error);
            return false;
        }
    },

    /**
     * Unsubscribe from push notifications
     */
    async unsubscribe(userId: string, endpoint: string): Promise<boolean> {
        try {
            await PushSubscription.deleteOne({ userId, endpoint });
            logger.info(`Push subscription removed for user: ${userId}`);
            return true;
        } catch (error) {
            logger.error('Failed to remove push subscription:', error);
            return false;
        }
    },

    /**
     * Send push notification to a specific user
     */
    async sendToUser(userId: string, payload: PushPayload): Promise<number> {
        if (!this.isConfigured()) {
            logger.warn('Push notifications not configured, skipping');
            return 0;
        }

        const subscriptions = await PushSubscription.find({ userId });
        let sent = 0;

        for (const sub of subscriptions) {
            try {
                await webPush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: sub.keys,
                    },
                    JSON.stringify({
                        title: payload.title,
                        body: payload.body,
                        icon: payload.icon || '/icon-192.png',
                        badge: payload.badge || '/badge-72.png',
                        data: {
                            url: payload.url || '/',
                            ...payload.data,
                        },
                    })
                );
                sent++;
            } catch (error: any) {
                // Remove invalid subscriptions
                if (error.statusCode === 404 || error.statusCode === 410) {
                    await PushSubscription.deleteOne({ _id: sub._id });
                    logger.info(`Removed expired push subscription: ${sub.endpoint}`);
                } else {
                    logger.error('Push notification failed:', error);
                }
            }
        }

        logger.info(`Sent ${sent}/${subscriptions.length} push notifications to user: ${userId}`);
        return sent;
    },

    /**
     * Send push notification to multiple users
     */
    async sendToUsers(userIds: string[], payload: PushPayload): Promise<number> {
        let totalSent = 0;
        for (const userId of userIds) {
            totalSent += await this.sendToUser(userId, payload);
        }
        return totalSent;
    },

    /**
     * Send push notification to all users (broadcast)
     */
    async broadcast(payload: PushPayload): Promise<number> {
        if (!this.isConfigured()) {
            return 0;
        }

        const subscriptions = await PushSubscription.find({});
        let sent = 0;

        for (const sub of subscriptions) {
            try {
                await webPush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: sub.keys,
                    },
                    JSON.stringify({
                        title: payload.title,
                        body: payload.body,
                        icon: payload.icon || '/icon-192.png',
                        badge: payload.badge || '/badge-72.png',
                        data: {
                            url: payload.url || '/',
                            ...payload.data,
                        },
                    })
                );
                sent++;
            } catch (error: any) {
                if (error.statusCode === 404 || error.statusCode === 410) {
                    await PushSubscription.deleteOne({ _id: sub._id });
                }
            }
        }

        logger.info(`Broadcast push notification to ${sent} devices`);
        return sent;
    },

    /**
     * Get user's subscription count
     */
    async getSubscriptionCount(userId: string): Promise<number> {
        return PushSubscription.countDocuments({ userId });
    },
};
