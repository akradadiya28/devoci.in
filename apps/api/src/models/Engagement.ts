/**
 * Engagement Model
 * Tracks user interactions for dynamic role computation
 */

import { Schema, model, Document } from 'mongoose';

export type EngagementType = 'VIEW' | 'SAVE' | 'SHARE' | 'RATE' | 'UNSAVE';

export interface IEngagement extends Document {
    userId: string;
    articleId: string;

    type: EngagementType;

    // For VIEW
    timeSpent?: number;  // seconds
    scrollDepth?: number;  // 0-100 percentage

    // For RATE
    rating?: number;  // 1-5

    // Learning Data (Premium)
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    topicCategory?: string;
    comprehensionScore?: number; // 0-100
    inWeeklyPlan?: boolean;
    weeklyPlanDay?: string;
    focusMode?: boolean;

    // Article metadata (denormalized for aggregation)
    articleRoles: string[];    // For role computation
    articleTags: string[];     // For interest extraction
    articleSkillLevel: string; // For skill level detection

    createdAt: Date;
}

const engagementSchema = new Schema<IEngagement>(
    {
        userId: { type: String, required: true, index: true },
        articleId: { type: String, required: true },

        type: {
            type: String,
            enum: ['VIEW', 'SAVE', 'SHARE', 'RATE', 'UNSAVE'],
            required: true,
        },

        timeSpent: { type: Number },
        scrollDepth: { type: Number },
        rating: { type: Number, min: 1, max: 5 },

        // Learning Data
        difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
        topicCategory: { type: String },
        comprehensionScore: { type: Number },
        inWeeklyPlan: { type: Boolean, default: false },
        weeklyPlanDay: { type: String },
        focusMode: { type: Boolean, default: false },

        // Denormalized for fast aggregation
        articleRoles: { type: [String], default: [] },
        articleTags: { type: [String], default: [] },
        articleSkillLevel: { type: String },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

// CRITICAL INDEXES for weekly role computation
engagementSchema.index({ userId: 1, createdAt: -1 });  // User timeline
engagementSchema.index({ articleId: 1, userId: 1 });   // Deduplication
engagementSchema.index({ userId: 1, type: 1 });        // Type filtering
engagementSchema.index({ createdAt: -1 });             // Time-based queries
engagementSchema.index({ userId: 1, inWeeklyPlan: 1 });// Plan analytics
engagementSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

export const Engagement = model<IEngagement>('Engagement', engagementSchema);
