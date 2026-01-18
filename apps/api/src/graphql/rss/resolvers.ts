/**
 * RSS Admin Resolvers
 */

import { RssSource } from '../../models';
import { rssQueue } from '../../jobs';
import { LeanRssSource } from '../../types';

export interface CreateRssSourceInput {
    url: string;
    name: string;
    category: string;
    description?: string;
    tags?: string[];
    targetRoles?: string[];
    updateFrequency?: number;
    priority?: number;
}

export const rssResolvers = {
    Query: {
        rssSources: async (
            _: unknown,
            args: { activeOnly?: boolean }
        ): Promise<LeanRssSource[]> => {
            const query = args.activeOnly ? { isActive: true } : {};
            return await RssSource.find(query)
                .sort({ priority: -1, name: 1 })
                .lean();
        },

        rssSource: async (
            _: unknown,
            args: { id: string }
        ): Promise<LeanRssSource | null> => {
            return await RssSource.findById(args.id).lean();
        },
    },

    Mutation: {
        createRssSource: async (
            _: unknown,
            { input }: { input: CreateRssSourceInput }
        ): Promise<LeanRssSource> => {
            const source = await RssSource.create({
                url: input.url,
                name: input.name,
                category: input.category,
                description: input.description,
                tags: input.tags || [],
                targetRoles: input.targetRoles || ['FRONTEND', 'BACKEND'],
                updateFrequency: input.updateFrequency || 120,
                priority: input.priority || 0.5,
                isActive: true,
            });

            return source.toObject() as LeanRssSource;
        },

        toggleRssSource: async (
            _: unknown,
            args: { id: string; active: boolean }
        ): Promise<LeanRssSource | null> => {
            return await RssSource.findByIdAndUpdate(
                args.id,
                { isActive: args.active, consecutiveErrors: 0 },
                { new: true }
            ).lean();
        },

        deleteRssSource: async (
            _: unknown,
            args: { id: string }
        ): Promise<boolean> => {
            const result = await RssSource.findByIdAndDelete(args.id);
            return !!result;
        },

        triggerRssFetch: async (): Promise<boolean> => {
            await rssQueue.add('fetch-all', {}, {
                jobId: `manual-${Date.now()}`,
            });
            return true;
        },
    },

    RssSource: {
        id: (source: LeanRssSource): string => source._id.toString(),
    },
};
