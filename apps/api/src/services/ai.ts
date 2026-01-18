/**
 * AI Service Interface (PUBLIC)
 * Abstract interface for AI scoring
 * Actual implementation in private/ai.impl.ts
 */

import { logger } from '../utils/logger';

// Types for AI scoring
export interface ArticleScoreResult {
    qualityScore: number;          // 0-10
    targetRoles: { role: string; weight: number }[];
    skillLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    tags: string[];
    isClickbait: boolean;
    summary?: string;
}

export interface AIScoreInput {
    title: string;
    description: string;
    content?: string;
    url: string;
    sourceName: string;
}

// AI Provider interface
export interface AIProvider {
    scoreArticle(input: AIScoreInput): Promise<ArticleScoreResult>;
    scoreBatch(inputs: AIScoreInput[]): Promise<ArticleScoreResult[]>;
    isAvailable(): Promise<boolean>;
}

// Default fallback scoring (no AI)
const fallbackScoring: AIProvider = {
    async scoreArticle(input: AIScoreInput): Promise<ArticleScoreResult> {
        // Basic heuristic scoring without AI
        const qualityScore = estimateQuality(input);
        const tags = extractBasicTags(input);
        const skillLevel = estimateSkillLevel(input);
        const isClickbait = detectClickbait(input.title);

        return {
            qualityScore,
            targetRoles: [{ role: 'FRONTEND', weight: 0.5 }, { role: 'BACKEND', weight: 0.5 }],
            skillLevel,
            tags,
            isClickbait,
        };
    },

    async scoreBatch(inputs: AIScoreInput[]): Promise<ArticleScoreResult[]> {
        return Promise.all(inputs.map(input => this.scoreArticle(input)));
    },

    async isAvailable(): Promise<boolean> {
        return true; // Fallback is always available
    },
};

// Heuristic quality estimation
function estimateQuality(input: AIScoreInput): number {
    let score = 5; // Base score

    // Title quality
    if (input.title.length > 20 && input.title.length < 100) score += 1;
    if (/\d/.test(input.title)) score += 0.5; // Numbers often indicate lists/specifics

    // Description quality
    if (input.description && input.description.length > 100) score += 1;
    if (input.description && input.description.length > 300) score += 0.5;

    // Content quality
    if (input.content && input.content.length > 500) score += 1;
    if (input.content && input.content.length > 2000) score += 0.5;

    // Clickbait penalty
    if (detectClickbait(input.title)) score -= 2;

    return Math.max(1, Math.min(10, score));
}

// Basic tag extraction
function extractBasicTags(input: AIScoreInput): string[] {
    const text = `${input.title} ${input.description}`.toLowerCase();
    const techTerms = [
        'javascript', 'typescript', 'react', 'vue', 'angular', 'node',
        'python', 'java', 'golang', 'rust', 'docker', 'kubernetes',
        'aws', 'azure', 'gcp', 'api', 'graphql', 'rest',
        'database', 'mongodb', 'postgresql', 'redis',
        'machine learning', 'ai', 'devops', 'security',
        'css', 'html', 'frontend', 'backend', 'mobile',
    ];

    return techTerms.filter(term => text.includes(term)).slice(0, 10);
}

// Skill level estimation
function estimateSkillLevel(input: AIScoreInput): 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' {
    const text = `${input.title} ${input.description}`.toLowerCase();

    const beginnerTerms = ['beginner', 'introduction', 'getting started', 'tutorial', 'basics', '101'];
    const advancedTerms = ['advanced', 'deep dive', 'internals', 'optimization', 'production', 'expert'];

    const beginnerMatch = beginnerTerms.filter(t => text.includes(t)).length;
    const advancedMatch = advancedTerms.filter(t => text.includes(t)).length;

    if (advancedMatch >= 2) return 'ADVANCED';
    if (beginnerMatch >= 2) return 'BEGINNER';
    return 'INTERMEDIATE';
}

// Clickbait detection
function detectClickbait(title: string): boolean {
    const clickbaitPatterns = [
        /you won't believe/i,
        /this will blow your mind/i,
        /one weird trick/i,
        /\d+\s+(things|ways|reasons|tips).*you/i,
        /what happens next/i,
        /shocking/i,
        /mind-blowing/i,
    ];

    return clickbaitPatterns.some(pattern => pattern.test(title));
}

// Current AI provider (can be swapped at runtime)
let currentProvider: AIProvider = fallbackScoring;

/**
 * AI Service - Public API
 */
export const aiService = {
    /**
     * Score a single article
     */
    async scoreArticle(input: AIScoreInput): Promise<ArticleScoreResult> {
        try {
            return await currentProvider.scoreArticle(input);
        } catch (error) {
            logger.error('AI scoring failed, using fallback', { error });
            return fallbackScoring.scoreArticle(input);
        }
    },

    /**
     * Score multiple articles in batch
     */
    async scoreBatch(inputs: AIScoreInput[]): Promise<ArticleScoreResult[]> {
        try {
            return await currentProvider.scoreBatch(inputs);
        } catch (error) {
            logger.error('AI batch scoring failed, using fallback', { error });
            return fallbackScoring.scoreBatch(inputs);
        }
    },

    /**
     * Check if AI provider is available
     */
    async isAvailable(): Promise<boolean> {
        return currentProvider.isAvailable();
    },

    /**
     * Set AI provider (called from private/ implementation)
     */
    setProvider(provider: AIProvider): void {
        currentProvider = provider;
        logger.info('AI provider set');
    },

    /**
     * Reset to fallback provider
     */
    resetToFallback(): void {
        currentProvider = fallbackScoring;
        logger.info('AI provider reset to fallback');
    },
};
