
import { Schema, model, Document } from 'mongoose';

export interface INotification extends Document {
    userId: Schema.Types.ObjectId;
    type: 'STREAK_RISK' | 'MILESTONE_UNLOCK' | 'SOCIAL_ENGAGEMENT' | 'SYSTEM';
    title: string;
    message: string;
    data?: any; // Payload for navigation (e.g. badgeId, articleId)
    isRead: boolean;
    createdAt: Date;
    expiresAt?: Date;
}

const notificationSchema = new Schema<INotification>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        type: {
            type: String,
            enum: ['STREAK_RISK', 'MILESTONE_UNLOCK', 'SOCIAL_ENGAGEMENT', 'SYSTEM'],
            required: true,
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        data: { type: Schema.Types.Mixed },
        isRead: { type: Boolean, default: false },
        expiresAt: { type: Date },
    },
    { timestamps: true }
);

// Indexes
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired

export const Notification = model<INotification>('Notification', notificationSchema);
