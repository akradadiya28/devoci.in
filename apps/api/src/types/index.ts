/**
 * Lean Types for Mongoose Documents
 * Use these types when calling .lean() on queries
 * Production-ready, strict TypeScript types
 */

import { Types } from 'mongoose';

// ============================================
// User Types
// ============================================

export interface DynamicRole {
    role: string;
    weight: number;
}

export interface UserPreferences {
    topics: string[];
    languages: string[];
    skillLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
}

export interface LeanUser {
    _id: Types.ObjectId;
    email: string;
    password: string;
    name: string;
    avatar?: string;
    dynamicRoles: DynamicRole[];
    preferences: UserPreferences;
    tokenVersion: number;
    isActive: boolean;
    isPremium: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastActiveAt?: Date;
}

// ============================================
// Article Types
// ============================================

export interface TargetRole {
    role: string;
    weight: number;
}

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface LeanArticle {
    _id: Types.ObjectId;
    title: string;
    description: string;
    content?: string;
    url: string;
    imageUrl?: string;
    sourceId: string;
    sourceName: string;
    author?: string;
    publishedAt: Date;
    qualityScore: number;
    targetRoles: TargetRole[];
    skillLevel: SkillLevel;
    tags: string[];
    isClickbait: boolean;
    scoredAt?: Date;
    views: number;
    saves: number;
    shares: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// Partial article for feed (with selected fields only)
export interface FeedArticle {
    _id: Types.ObjectId;
    title: string;
    description: string;
    url: string;
    imageUrl?: string;
    sourceName: string;
    publishedAt: Date;
    qualityScore: number;
    targetRoles: TargetRole[];
    skillLevel: SkillLevel;
    tags: string[];
    views: number;
    saves: number;
}

// Scored article for personalized feed
export interface ScoredArticle extends FeedArticle {
    relevanceScore: number;
}

// ============================================
// RSS Source Types
// ============================================

export interface LeanRssSource {
    _id: Types.ObjectId;
    url: string;
    name: string;
    category: string;
    description?: string;
    isActive: boolean;
    updateFrequency: number;
    priority: number;
    tags: string[];
    targetRoles: string[];
    quality: number;
    trustScore: number;
    lastFetchAt?: Date;
    nextFetchAt?: Date;
    articleCount: number;
    errorCount: number;
    consecutiveErrors: number;
    lastError?: string;
    createdAt: Date;
    updatedAt: Date;
}

// ============================================
// Engagement Types
// ============================================

export type EngagementType = 'VIEW' | 'SAVE' | 'SHARE' | 'RATE' | 'UNSAVE';

export interface LeanEngagement {
    _id: Types.ObjectId;
    userId: string;
    articleId: string;
    type: EngagementType;
    timeSpent?: number;
    scrollDepth?: number;
    rating?: number;
    articleRoles: string[];
    articleTags: string[];
    articleSkillLevel: string;
    createdAt: Date;
}

// ============================================
// Saved Article Types
// ============================================

export interface LeanSavedArticle {
    _id: Types.ObjectId;
    userId: string;
    articleId: string;
    tags?: string[];
    notes?: string;
    savedAt: Date;
}

// ============================================
// Auth Types
// ============================================

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface JWTPayload {
    userId: string;
    email: string;
}

export interface RefreshTokenPayload extends JWTPayload {
    tokenVersion: number;
}

// ============================================
// Onboarding Types
// ============================================

export interface DynamicRoleInput {
    role: string;
    weight: number;
}

export interface OnboardingInput {
    dynamicRoles: DynamicRoleInput[];
    skillLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    interests: string[];
    preferredTags: string[];
}
