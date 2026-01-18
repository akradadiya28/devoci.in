import { IArticle } from '../models';
import { logger } from '../utils/logger';
import { Article } from '../models';

// Try to load EE implementation
let eeService: any;
try {
    eeService = require('../ee/services/aiRecommendation').aiRecommendationService;
} catch (e) {
    logger.debug('EE AI Recommendation service not found, using fallback');
}

export const aiRecommendationService = {
    async getRecommendations(userId: string, limit: number = 5): Promise<IArticle[]> {
        if (eeService) return eeService.getRecommendations(userId, limit);

        // Fallback: Return latest articles
        return Article.find({ isActive: true })
            .sort({ publishedAt: -1 })
            .limit(limit)
            .lean() as unknown as IArticle[];
    }
};
