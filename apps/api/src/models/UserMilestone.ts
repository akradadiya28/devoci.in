/**
 * User Milestone Model
 * Tracks achievement progress and unlocks
 */

import { Schema, model, Document, Types } from 'mongoose';

export interface IUserMilestone extends Document {
    userId: Types.ObjectId;

    milestoneId: string;        // e.g. "7_day_streak"
    milestoneName: string;
    milestoneCategory: 'streak' | 'topic' | 'engagement' | 'time';
    description: string;

    // Status
    achieved: boolean;
    achievedAt?: Date;
    progress: number;           // 0.0 to 1.0 (or higher)
    currentValue: number;       // e.g. 5 (articles read)
    targetValue: number;        // e.g. 50

    // Rewards
    pointsAwarded: number;
    badgeId?: string;

    // Social
    notificationSent: boolean;
    socialShareCount: number;

    createdAt: Date;
    updatedAt: Date;
}

const userMilestoneSchema = new Schema<IUserMilestone>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

        milestoneId: { type: String, required: true },
        milestoneName: { type: String, required: true },
        milestoneCategory: {
            type: String,
            enum: ['streak', 'topic', 'engagement', 'time'],
            required: true
        },
        description: { type: String },

        achieved: { type: Boolean, default: false },
        achievedAt: { type: Date },
        progress: { type: Number, default: 0 },
        currentValue: { type: Number, default: 0 },
        targetValue: { type: Number, required: true },

        pointsAwarded: { type: Number, default: 0 },
        badgeId: { type: String },

        notificationSent: { type: Boolean, default: false },
        socialShareCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// Indexes
userMilestoneSchema.index({ userId: 1, milestoneId: 1 }, { unique: true });
userMilestoneSchema.index({ userId: 1, achieved: 1 });

export const UserMilestone = model<IUserMilestone>('UserMilestone', userMilestoneSchema);
