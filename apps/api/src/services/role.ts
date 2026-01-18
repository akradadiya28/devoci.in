/**
 * Role Computation Service
 * Computes user dynamic roles based on their engagement patterns
 * Updated weekly to reflect evolving interests
 */

import { User, Engagement } from '../models';
import { logger } from '../utils/logger';
import { DynamicRole } from '../types';
import { cache } from '../db/redis';
import { Types } from 'mongoose';

// Smoothing factor for role updates (0-1, higher = more responsive to changes)
// Per Onboarding Doc: 0.7 * Calculated + 0.3 * Old
const SMOOTHING_FACTOR = 0.7;

// Valid roles
const VALID_ROLES = ['FRONTEND', 'BACKEND', 'DEVOPS', 'ML', 'MOBILE', 'DATA', 'SECURITY'];

interface UserRoleUpdate {
    userId: string;
    previousRoles: DynamicRole[];
    newRoles: DynamicRole[];
    engagementsProcessed: number;
}

export const roleService = {
    /**
     * Compute role weights for a single user based on recent engagement
     */
    async computeUserRoles(userId: string, days: number = 30): Promise<DynamicRole[]> {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Get user's engagements with article data
        const engagements = await Engagement.aggregate([
            {
                $match: {
                    userId: new Types.ObjectId(userId),
                    createdAt: { $gte: since },
                    type: { $in: ['VIEW', 'SAVE', 'SHARE'] },
                },
            },
            // Lookup article for role information
            {
                $lookup: {
                    from: 'articles',
                    localField: 'articleId',
                    foreignField: '_id',
                    as: 'article',
                },
            },
            { $unwind: '$article' },
            // Weight engagements: save=3, share=5, view=1
            {
                $addFields: {
                    engagementWeight: {
                        $switch: {
                            branches: [
                                { case: { $eq: ['$type', 'SAVE'] }, then: 3 },
                                { case: { $eq: ['$type', 'SHARE'] }, then: 5 },
                            ],
                            default: 1,
                        },
                    },
                },
            },
            // Unwind article target roles
            { $unwind: '$article.targetRoles' },
            // Group by role
            {
                $group: {
                    _id: '$article.targetRoles.role',
                    totalWeight: {
                        $sum: {
                            $multiply: [
                                '$engagementWeight',
                                '$article.targetRoles.weight',
                            ],
                        },
                    },
                    count: { $sum: 1 },
                },
            },
        ]);

        if (engagements.length === 0) {
            return [];
        }

        // Calculate total weight for normalization
        const totalWeight = engagements.reduce((sum, e) => sum + e.totalWeight, 0);

        if (totalWeight === 0) {
            return [];
        }

        // Normalize to get role weights (sum = 1)
        const roles: DynamicRole[] = engagements
            .filter(e => VALID_ROLES.includes(e._id))
            .map(e => ({
                role: e._id,
                weight: Math.round((e.totalWeight / totalWeight) * 100) / 100,
            }))
            .filter(r => r.weight >= 0.05) // Minimum 5% weight
            .sort((a, b) => b.weight - a.weight);

        return roles;
    },

    /**
     * Apply smoothing to role updates (gradual transition)
     */
    smoothRoles(previous: DynamicRole[], computed: DynamicRole[]): DynamicRole[] {
        if (previous.length === 0) {
            return computed;
        }

        // Create lookup for previous roles
        const prevMap = new Map(previous.map(r => [r.role, r.weight]));

        // Apply exponential smoothing
        const smoothed = computed.map(r => {
            const prevWeight = prevMap.get(r.role) || 0;
            const smoothedWeight =
                SMOOTHING_FACTOR * r.weight +
                (1 - SMOOTHING_FACTOR) * prevWeight;

            return {
                role: r.role,
                weight: Math.round(smoothedWeight * 100) / 100,
            };
        });

        // Keep roles from previous that still have weight
        for (const prev of previous) {
            if (!smoothed.find(s => s.role === prev.role)) {
                const decayedWeight = prev.weight * (1 - SMOOTHING_FACTOR);
                if (decayedWeight >= 0.05) {
                    smoothed.push({
                        role: prev.role,
                        weight: Math.round(decayedWeight * 100) / 100,
                    });
                }
            }
        }

        // Normalize weights
        const total = smoothed.reduce((sum, r) => sum + r.weight, 0);
        return smoothed
            .map(r => ({
                role: r.role,
                weight: Math.round((r.weight / total) * 100) / 100,
            }))
            .sort((a, b) => b.weight - a.weight);
    },

    /**
     * Update roles for a single user
     */
    async updateUserRoles(userId: string): Promise<UserRoleUpdate | null> {
        const user = await User.findById(userId);
        if (!user) return null;

        const previousRoles = user.dynamicRoles || [];
        const computedRoles = await this.computeUserRoles(userId);

        if (computedRoles.length === 0) {
            return null; // Not enough engagement data
        }

        const newRoles = this.smoothRoles(previousRoles, computedRoles);

        // Update user
        await User.findByIdAndUpdate(userId, {
            dynamicRoles: newRoles,
            lastActiveAt: new Date(),
        });

        // Invalidate user's feed cache
        await cache.del(`feed:user:${userId}`);

        return {
            userId,
            previousRoles,
            newRoles,
            engagementsProcessed: computedRoles.length,
        };
    },

    /**
     * Batch update roles for all active users
     */
    async updateAllUserRoles(days: number = 30): Promise<{
        usersProcessed: number;
        usersUpdated: number;
        errors: number;
    }> {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Find users with recent engagement
        const activeUserIds = await Engagement.distinct('userId', {
            createdAt: { $gte: since },
        });

        logger.info(`Processing roles for ${activeUserIds.length} active users`);

        let usersUpdated = 0;
        let errors = 0;

        for (const userId of activeUserIds) {
            try {
                const result = await this.updateUserRoles(userId.toString());
                if (result) {
                    usersUpdated++;
                    logger.debug(`Updated roles for user ${userId}`, {
                        roles: result.newRoles,
                    });
                }
            } catch (error) {
                errors++;
                logger.error(`Failed to update roles for user ${userId}`, { error });
            }
        }

        logger.info(`Role computation complete`, {
            usersProcessed: activeUserIds.length,
            usersUpdated,
            errors,
        });

        return {
            usersProcessed: activeUserIds.length,
            usersUpdated,
            errors,
        };
    },

    /**
     * Estimate skill level based on engagement patterns
     */
    async estimateSkillLevel(userId: string): Promise<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'> {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const skillDistribution = await Engagement.aggregate([
            {
                $match: {
                    userId: new Types.ObjectId(userId),
                    createdAt: { $gte: thirtyDaysAgo },
                },
            },
            {
                $lookup: {
                    from: 'articles',
                    localField: 'articleId',
                    foreignField: '_id',
                    as: 'article',
                },
            },
            { $unwind: '$article' },
            {
                $group: {
                    _id: '$article.skillLevel',
                    count: { $sum: 1 },
                },
            },
        ]);

        if (skillDistribution.length === 0) {
            return 'INTERMEDIATE'; // Default
        }

        // Weight skill levels
        const weights = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3 };
        let totalWeight = 0;
        let totalCount = 0;

        for (const skill of skillDistribution) {
            const w = weights[skill._id as keyof typeof weights] || 2;
            totalWeight += w * skill.count;
            totalCount += skill.count;
        }

        const avgWeight = totalWeight / totalCount;

        if (avgWeight <= 1.5) return 'BEGINNER';
        if (avgWeight >= 2.5) return 'ADVANCED';
        return 'INTERMEDIATE';
    },

    /**
     * Get user's current role profile
     */
    async getRoleProfile(userId: string): Promise<{
        roles: DynamicRole[];
        skillLevel: string;
        totalEngagements: number;
    }> {
        const user = await User.findById(userId).lean();
        const skillLevel = await this.estimateSkillLevel(userId);

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const totalEngagements = await Engagement.countDocuments({
            userId: new Types.ObjectId(userId),
            createdAt: { $gte: thirtyDaysAgo },
        });

        return {
            roles: user?.dynamicRoles || [],
            skillLevel,
            totalEngagements,
        };
    },
};
