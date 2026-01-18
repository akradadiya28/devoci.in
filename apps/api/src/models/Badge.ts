/**
 * Badge Model
 * Visual achievements that users collect
 */

import { Schema, model, Document, Types } from 'mongoose';

export interface IBadge extends Document {
    badgeId: string;            // e.g. "badge_silver_streak"
    badgeName: string;
    badgeDescription: string;

    iconUrl: string;
    badgeColor: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'legendary';

    // Levels logic (optional but useful)
    level?: number;
    maxLevel?: number;

    unlockedByMilestoneId: string;
    pointsValue: number;

    displayOnProfile: boolean;

    createdAt: Date;
    updatedAt: Date;
}

const badgeSchema = new Schema<IBadge>(
    {
        badgeId: { type: String, required: true, unique: true },
        badgeName: { type: String, required: true },
        badgeDescription: { type: String },

        iconUrl: { type: String, required: true },
        badgeColor: { type: String, default: '#CCCCCC' },
        rarity: {
            type: String,
            enum: ['common', 'uncommon', 'rare', 'legendary'],
            default: 'common'
        },

        level: { type: Number, default: 1 },
        maxLevel: { type: Number, default: 1 },

        unlockedByMilestoneId: { type: String, required: true },
        pointsValue: { type: Number, default: 0 },

        displayOnProfile: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export const Badge = model<IBadge>('Badge', badgeSchema);

/**
 * UserBadge Model
 * Relationship between User and Badge
 */
export interface IUserBadge extends Document {
    userId: Types.ObjectId;
    badgeId: Types.ObjectId;

    achievedAt: Date;
    displayPosition?: number;
    pinned: boolean;

    createdAt: Date;
}

const userBadgeSchema = new Schema<IUserBadge>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        badgeId: { type: Schema.Types.ObjectId, ref: 'Badge', required: true },

        achievedAt: { type: Date, default: Date.now },
        displayPosition: { type: Number },
        pinned: { type: Boolean, default: false },
    },
    { timestamps: true }
);

userBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });

export const UserBadge = model<IUserBadge>('UserBadge', userBadgeSchema);
