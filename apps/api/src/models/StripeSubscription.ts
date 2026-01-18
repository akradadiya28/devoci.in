/**
 * Stripe Subscription Model
 * Tracks user subscriptions
 */

import { Schema, model, Document } from 'mongoose';

export type SubscriptionStatus = 'active' | 'past_due' | 'unpaid' | 'canceled' | 'ended' | 'trialing';

export interface IStripeSubscription extends Document {
    userId: string;
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    priceId: string;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    canceledAt?: Date;
    canceledReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

const stripeSubscriptionSchema = new Schema<IStripeSubscription>(
    {
        userId: { type: String, required: true, index: true },
        stripeSubscriptionId: { type: String, required: true, unique: true },
        stripeCustomerId: { type: String, required: true },
        priceId: { type: String, required: true },
        status: {
            type: String,
            enum: ['active', 'past_due', 'unpaid', 'canceled', 'ended', 'trialing'],
            default: 'active',
        },
        currentPeriodStart: { type: Date, required: true },
        currentPeriodEnd: { type: Date, required: true },
        canceledAt: { type: Date },
        canceledReason: { type: String },
    },
    { timestamps: true }
);


stripeSubscriptionSchema.index({ userId: 1, status: 1 });

export const StripeSubscription = model<IStripeSubscription>('StripeSubscription', stripeSubscriptionSchema);
