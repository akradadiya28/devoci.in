import { logger } from '../utils/logger';

// Try to load EE implementation
let eeService: any;
try {
    // Dynamic require to avoid build errors if file missing
    eeService = require('../ee/services/gamification').gamificationService;
} catch (e) {
    logger.debug('EE Gamification service not found, using fallback');
}

export const gamificationService = {
    async checkStreak(userId: string): Promise<{ streakCount: number; broken: boolean }> {
        if (eeService) return eeService.checkStreak(userId);
        return { streakCount: 0, broken: false };
    },

    async checkStreakMilestones(userId: string, currentStreak: number): Promise<void> {
        if (eeService) return eeService.checkStreakMilestones(userId, currentStreak);
    },

    async checkReadingMilestones(userId: string): Promise<void> {
        if (eeService) return eeService.checkReadingMilestones(userId);
    },

    async checkEngagementMilestones(userId: string, type: 'SHARE' | 'SAVE'): Promise<void> {
        if (eeService) return eeService.checkEngagementMilestones(userId, type);
    },

    async awardMilestone(userId: string, milestoneId: string, meta: any): Promise<void> {
        if (eeService) return eeService.awardMilestone(userId, milestoneId, meta);
    },

    async shareAchievement(userId: string, input: any): Promise<any> {
        if (eeService) return eeService.shareAchievement(userId, input);
        return { success: false, message: 'Feature available in Premium' };
    },

    async getLeaderboard(type: string, period: string = 'ALL_TIME', limit: number = 10): Promise<any[]> {
        if (eeService) return eeService.getLeaderboard(type, period, limit);
        return [];
    }
};
