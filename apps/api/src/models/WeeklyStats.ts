/**
 * Weekly Stats Model
 * Stores aggregated weekly reading statistics
 */

import { Schema, model, Document, Types } from 'mongoose';

export interface IWeeklyStats extends Document {
    userId: Types.ObjectId;

    // Timeframe
    weekStart: Date;
    weekEnd: Date;
    weekNumber: number;
    year: number;

    // Activity
    articlesRead: number;
    readingDays: number;
    totalReadingTime: number; // Seconds

    // Breakdown
    topicBreakdown: Record<string, { count: number; time: number }>;
    topTags: Array<{ tag: string; count: number }>;

    // Engagement
    articlesShared: number;
    articlesSaved: number;
    engagementScore: number; // 0-100

    // Highlights
    bestDay: string;
    bestDayArticles: number;

    createdAt: Date;
    updatedAt: Date;
}

const weeklyStatsSchema = new Schema<IWeeklyStats>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

        weekStart: { type: Date, required: true },
        weekEnd: { type: Date, required: true },
        weekNumber: { type: Number, required: true },
        year: { type: Number, required: true },

        articlesRead: { type: Number, default: 0 },
        readingDays: { type: Number, default: 0 },
        totalReadingTime: { type: Number, default: 0 },

        topicBreakdown: { type: Map, of: Object, default: {} },
        topTags: [{ tag: String, count: Number }],

        articlesShared: { type: Number, default: 0 },
        articlesSaved: { type: Number, default: 0 },
        engagementScore: { type: Number, default: 0 },

        bestDay: { type: String },
        bestDayArticles: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// Indexes
weeklyStatsSchema.index({ userId: 1, year: 1, weekNumber: 1 }, { unique: true });

export const WeeklyStats = model<IWeeklyStats>('WeeklyStats', weeklyStatsSchema);
