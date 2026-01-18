/**
 * Push Subscription Model
 * Stores user push notification subscriptions (Web Push API)
 */

import { Schema, model, Document } from 'mongoose';

export interface IPushSubscription extends Document {
    userId: string;
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
    userAgent?: string;
    createdAt: Date;
    updatedAt: Date;
}

const pushSubscriptionSchema = new Schema<IPushSubscription>(
    {
        userId: { type: String, required: true, index: true },
        endpoint: { type: String, required: true, unique: true },
        keys: {
            p256dh: { type: String, required: true },
            auth: { type: String, required: true },
        },
        userAgent: { type: String },
    },
    { timestamps: true }
);

// Index for fast lookup by user
pushSubscriptionSchema.index({ userId: 1, endpoint: 1 });

export const PushSubscription = model<IPushSubscription>('PushSubscription', pushSubscriptionSchema);
