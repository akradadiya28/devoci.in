/**
 * Engagement Resolvers
 */

import { engagementService, gamificationService } from '../../services';
import { GraphQLContext, requireAuth } from '../../middleware';
import { logger } from '../../utils/logger';

export const engagementResolvers = {
    Mutation: {
        viewArticle: async (
            _: unknown,
            args: { articleId: string },
            context: GraphQLContext
        ): Promise<boolean> => {
            const user = requireAuth(context);
            return engagementService.viewArticle(user._id, args.articleId);
        },

        saveArticle: async (
            _: unknown,
            args: { articleId: string },
            context: GraphQLContext
        ): Promise<boolean> => {
            const user = requireAuth(context);
            return engagementService.saveArticle(user._id, args.articleId);
        },

        shareArticle: async (
            _: unknown,
            args: { articleId: string; platform: string },
            context: GraphQLContext
        ): Promise<boolean> => {
            const user = requireAuth(context);
            return engagementService.shareArticle(user._id, args.articleId, args.platform);
        },

        shareAchievement: async (
            _: unknown,
            args: { input: any },
            context: GraphQLContext
        ) => {
            const user = requireAuth(context);
            return gamificationService.shareAchievement(user._id, args.input);
        },
    },

    Query: {
        myEngagement: async (_: unknown, __: unknown, context: GraphQLContext) => {
            const user = requireAuth(context);
            logger.debug(`Fetching engagement for user ${user._id}`);
            // TODO: Implement list query if needed
            return [];
        },

        leaderboard: async (
            _: unknown,
            args: { type: string; period?: string; limit?: number },
            __: GraphQLContext
        ) => {
            // Public endpoint? Or require auth? Leaderboards usually public-ish.
            return gamificationService.getLeaderboard(args.type, args.period, args.limit);
        }
    }
};
