
import { notificationService, pushService } from '../../services';
import { GraphQLContext, requireAuth } from '../../middleware';
import { INotification } from '../../models';

export const notificationResolvers = {
    Query: {
        myNotifications: async (
            _: unknown,
            args: { limit?: number; unreadOnly?: boolean },
            context: GraphQLContext
        ): Promise<INotification[]> => {
            const user = requireAuth(context);
            return notificationService.getUserNotifications(user._id, args.limit, args.unreadOnly);
        },

        unreadNotificationCount: async (
            _: unknown,
            __: unknown,
            context: GraphQLContext
        ): Promise<number> => {
            const user = requireAuth(context);
            return notificationService.getUnreadCount(user._id);
        },

        getPushConfig: async (): Promise<{ publicKey: string | null; isConfigured: boolean }> => {
            return {
                publicKey: pushService.getPublicKey(),
                isConfigured: pushService.isConfigured(),
            };
        },
    },

    Mutation: {
        markNotificationRead: async (
            _: unknown,
            args: { id: string },
            context: GraphQLContext
        ): Promise<boolean> => {
            const user = requireAuth(context);
            return notificationService.markAsRead(args.id, user._id);
        },

        markAllNotificationsRead: async (
            _: unknown,
            __: unknown,
            context: GraphQLContext
        ): Promise<boolean> => {
            const user = requireAuth(context);
            return notificationService.markAllAsRead(user._id);
        },

        subscribeToPush: async (
            _: unknown,
            args: { subscription: { endpoint: string; keys: { p256dh: string; auth: string } } },
            context: GraphQLContext
        ): Promise<boolean> => {
            const user = requireAuth(context);
            return pushService.subscribe(user._id, args.subscription);
        },

        unsubscribeFromPush: async (
            _: unknown,
            args: { endpoint: string },
            context: GraphQLContext
        ): Promise<boolean> => {
            const user = requireAuth(context);
            return pushService.unsubscribe(user._id, args.endpoint);
        },
    },

    // Field resolvers
    Notification: {
        id: (notification: INotification): string => notification._id.toString(),
        createdAt: (notification: INotification): string => notification.createdAt.toISOString()
    }
};
