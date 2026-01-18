/**
 * Feed Resolvers
 * Production-ready with proper types
 */

import { feedService, authService } from '../../services';
import { GraphQLContext, requireAuth } from '../../middleware';
import { FeedArticle, ScoredArticle } from '../../types';

export interface FeedArgs {
    limit?: number;
    cursor?: string;
}

export interface FeedConnection {
    articles: (FeedArticle | ScoredArticle)[];
    nextCursor: string | null;
    hasMore: boolean;
}

export const feedResolvers = {
    Query: {
        feed: async (
            _: unknown,
            args: FeedArgs,
            context: GraphQLContext
        ): Promise<FeedConnection> => {
            // Require login for feed access
            const sessionUser = requireAuth(context);
            const user = await authService.getUserById(sessionUser._id);

            const articles = await feedService.getPersonalizedFeed(user, {
                limit: args.limit || 20,
                cursor: args.cursor,
            });

            const hasMore = articles.length === (args.limit || 20);
            const nextCursor = hasMore && articles.length > 0
                ? articles[articles.length - 1]._id.toString()
                : null;

            return {
                articles,
                nextCursor,
                hasMore,
            };
        },
    },
};
