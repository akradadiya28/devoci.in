import { logger } from '../utils/logger';

// Try to load EE implementation
let eeService: any;
try {
    eeService = require('../ee/services/learningGap').learningGapService;
} catch (e) {
    logger.debug('EE Learning Gap service not found, using fallback');
}

export const learningGapService = {
    async analyzeGaps(userId: string): Promise<any> {
        if (eeService) return eeService.analyzeGaps(userId);
        return {
            message: 'Learning Gap Analysis is a Premium Feature',
            gaps: []
        };
    },

    async getGapHistory(userId: string): Promise<any[]> {
        if (eeService) return eeService.getGapHistory(userId);
        return [];
    }
};
