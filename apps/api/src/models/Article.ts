/**
 * Article Model
 * Optimized with indexes for 1000+ concurrent users
 */

import { Schema, model, Document } from 'mongoose';

// Target role with weight (for personalization matching)
export interface TargetRole {
    role: string;
    weight: number;
}

export interface IArticle extends Document {
    // Content
    title: string;
    description: string;
    content?: string;
    url: string;
    imageUrl?: string;

    // Source info
    sourceId: string;      // Reference to RssSource
    sourceName: string;
    author?: string;
    publishedAt: Date;

    // AI-computed fields (dynamic, from Gemini)
    qualityScore: number;  // 0-10
    targetRoles: TargetRole[];
    skillLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    tags: string[];
    isClickbait: boolean;
    scoredAt?: Date;

    // Engagement metrics
    views: number;
    saves: number;
    shares: number;

    // Status
    isActive: boolean;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

const targetRoleSchema = new Schema<TargetRole>(
    {
        role: { type: String, required: true },
        weight: { type: Number, required: true, min: 0, max: 1 },
    },
    { _id: false }
);

const articleSchema = new Schema<IArticle>(
    {
        title: { type: String, required: true },
        description: { type: String, required: true },
        content: { type: String },
        url: { type: String, required: true, unique: true },
        imageUrl: { type: String },

        sourceId: { type: String, required: true },
        sourceName: { type: String, required: true },
        author: { type: String },
        publishedAt: { type: Date, required: true },

        // AI fields
        qualityScore: { type: Number, default: 0, min: 0, max: 10 },
        targetRoles: { type: [targetRoleSchema], default: [] },
        skillLevel: {
            type: String,
            enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
            default: 'BEGINNER',
        },
        tags: { type: [String], default: [] },
        isClickbait: { type: Boolean, default: false },
        scoredAt: { type: Date },

        // Engagement
        views: { type: Number, default: 0 },
        saves: { type: Number, default: 0 },
        shares: { type: Number, default: 0 },

        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// CRITICAL INDEXES (per backend.md - for scale)
// Note: url index auto-created by unique:true in schema
articleSchema.index({ qualityScore: -1, createdAt: -1 });  // Feed sorting
articleSchema.index({ 'targetRoles.role': 1, qualityScore: -1 });  // Role filtering
articleSchema.index({ tags: 1 });  // Tag filtering
articleSchema.index({ sourceId: 1 });  // Source filtering
articleSchema.index({ publishedAt: -1 });  // Time-based queries
articleSchema.index({ isClickbait: 1, qualityScore: -1 });  // Quality filter

// TTL index: Auto-delete low quality articles after 90 days
articleSchema.index(
    { createdAt: 1 },
    {
        expireAfterSeconds: 90 * 24 * 60 * 60,  // 90 days
        partialFilterExpression: { qualityScore: { $lt: 5 } }
    }
);

export const Article = model<IArticle>('Article', articleSchema);
