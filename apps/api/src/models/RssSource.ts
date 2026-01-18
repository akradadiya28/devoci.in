/**
 * RSS Source Model
 * Dynamic RSS sources - database driven, not hardcoded
 */

import { Schema, model, Document } from 'mongoose';

export interface IRssSource extends Document {
    // Source info
    url: string;
    name: string;
    category: string;
    description?: string;

    // Status
    isActive: boolean;

    // Fetch configuration (dynamic!)
    updateFrequency: number;  // minutes between fetches
    priority: number;         // 0-1 (higher = fetched more often)

    // Targeting
    tags: string[];
    targetRoles: string[];

    // Quality metrics
    quality: number;           // 0-1 (how good are articles from this source)
    trustScore: number;        // 0-1 (reliability)

    // Fetch stats
    lastFetchAt?: Date;
    nextFetchAt?: Date;
    articleCount: number;
    errorCount: number;
    consecutiveErrors: number;
    lastError?: string;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

const rssSourceSchema = new Schema<IRssSource>(
    {
        url: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        category: { type: String, required: true },
        description: { type: String },

        isActive: { type: Boolean, default: true },

        // Dynamic fetch config
        updateFrequency: { type: Number, default: 120 },  // 2 hours
        priority: { type: Number, default: 0.5, min: 0, max: 1 },

        tags: { type: [String], default: [] },
        targetRoles: { type: [String], default: ['FRONTEND', 'BACKEND'] },

        quality: { type: Number, default: 0.5, min: 0, max: 1 },
        trustScore: { type: Number, default: 0.5, min: 0, max: 1 },

        lastFetchAt: { type: Date },
        nextFetchAt: { type: Date },
        articleCount: { type: Number, default: 0 },
        errorCount: { type: Number, default: 0 },
        consecutiveErrors: { type: Number, default: 0 },
        lastError: { type: String },
    },
    { timestamps: true }
);

// Indexes
rssSourceSchema.index({ isActive: 1, nextFetchAt: 1 });  // Fetch queue
rssSourceSchema.index({ priority: -1 });  // Priority sorting
rssSourceSchema.index({ category: 1 });
rssSourceSchema.index({ targetRoles: 1 });

export const RssSource = model<IRssSource>('RssSource', rssSourceSchema);
