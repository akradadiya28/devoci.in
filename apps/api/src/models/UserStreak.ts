/**
 * User Streak Model
 * Tracks daily reading streaks and history
 */

import { Schema, model, Document, Types } from 'mongoose';

export interface IUserStreak extends Document {
    userId: Types.ObjectId;

    // Current streak
    currentStreakCount: number;
    currentStreakStart: Date;

    // Best streak
    bestStreakCount: number;
    bestStreakStart: Date;
    bestStreakEnd?: Date;

    // History
    totalReadingDays: number;
    totalArticlesRead: number;
    lastReadDate: Date;

    // Stats
    streakBrokenCount: number;
    longestBreakDays: number;
    lastStreakBrokenDate?: Date;

    createdAt: Date;
    updatedAt: Date;
}

const userStreakSchema = new Schema<IUserStreak>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

        currentStreakCount: { type: Number, default: 0, index: -1 },
        currentStreakStart: { type: Date },

        bestStreakCount: { type: Number, default: 0, index: -1 },
        bestStreakStart: { type: Date },
        bestStreakEnd: { type: Date },

        totalReadingDays: { type: Number, default: 0 },
        totalArticlesRead: { type: Number, default: 0 },
        lastReadDate: { type: Date },

        streakBrokenCount: { type: Number, default: 0 },
        longestBreakDays: { type: Number, default: 0 },
        lastStreakBrokenDate: { type: Date },
    },
    { timestamps: true }
);

// Indexes


export const UserStreak = model<IUserStreak>('UserStreak', userStreakSchema);
