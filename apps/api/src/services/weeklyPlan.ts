import { logger } from '../utils/logger';

// Try to load EE implementation
let eeService: any;
try {
    eeService = require('../ee/services/weeklyPlan').weeklyPlanService;
} catch (e) {
    logger.debug('EE Weekly Plan service not found, using fallback');
}

export const weeklyPlanService = {
    async generatePlan(userId: string): Promise<any> {
        if (eeService) return eeService.generatePlan(userId);
        return {
            message: 'AI Weekly Plans are available in Premium Edition',
            plan: []
        };
    },

    async getCurrentPlan(userId: string): Promise<any> {
        if (eeService) return eeService.getCurrentPlan(userId);
        return null;
    }
};
