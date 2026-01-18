/**
 * Article Resolvers
 * Production-ready with proper types
 */

import { articleService, feedService } from '../../services';
import { FeedArticle, LeanArticle } from '../../types';
import { GraphQLContext, requireAuth } from '../../middleware';

export interface ArticlesArgs {
    limit?: number;
    cursor?: string;
    roles?: string[];
    tags?: string[];
    skillLevel?: string;
    minQuality?: number;
}

export interface ArticleConnection {
    articles: FeedArticle[];
    nextCursor: string | null;
    hasMore: boolean;
}

export const articleResolvers = {
    Query: {
        articles: async (_: unknown, args: ArticlesArgs, context: GraphQLContext): Promise<ArticleConnection> => {
            requireAuth(context);
            const articles = await articleService.getArticles({
                limit: args.limit || 20,
                cursor: args.cursor,
                roles: args.roles,
                tags: args.tags,
                skillLevel: args.skillLevel,
                minQuality: args.minQuality,
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

        article: async (_: unknown, args: { id: string }, context: GraphQLContext): Promise<LeanArticle | null> => {
            requireAuth(context);
            return articleService.getById(args.id);
        },

        trending: async (_: unknown, args: { days?: number; limit?: number }, context: GraphQLContext): Promise<FeedArticle[]> => {
            requireAuth(context);
            return feedService.getTrending(args.days || 7, args.limit || 10);
        },
    },

    Mutation: {
        viewArticle: async (_: unknown, args: { id: string }): Promise<boolean> => {
            await articleService.incrementViews(args.id);
            return true;
        },

        saveArticle: async (_: unknown, args: { id: string; save: boolean }): Promise<boolean> => {
            await articleService.toggleSave(args.id, args.save);
            return true;
        },
    },

    // Field resolvers
    Article: {
        id: (article: FeedArticle): string => article._id.toString(),
    },
};
