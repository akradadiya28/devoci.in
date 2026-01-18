/**
 * Stripe Payment Method Model
 * Stores user payment methods
 */

import { Schema, model, Document } from 'mongoose';

export interface CardDetails {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    fingerprint?: string;
}

export interface IStripePaymentMethod extends Document {
    userId: string;
    stripePaymentMethodId: string;
    stripeCustomerId: string;
    type: 'card' | 'upi' | 'wallet';
    card?: CardDetails;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const cardDetailsSchema = new Schema<CardDetails>(
    {
        brand: { type: String },
        last4: { type: String },
        expMonth: { type: Number },
        expYear: { type: Number },
        fingerprint: { type: String },
    },
    { _id: false }
);

const stripePaymentMethodSchema = new Schema<IStripePaymentMethod>(
    {
        userId: { type: String, required: true, index: true },
        stripePaymentMethodId: { type: String, required: true, unique: true },
        stripeCustomerId: { type: String, required: true },
        type: {
            type: String,
            enum: ['card', 'upi', 'wallet'],
            default: 'card',
        },
        card: { type: cardDetailsSchema },
        isDefault: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const StripePaymentMethod = model<IStripePaymentMethod>('StripePaymentMethod', stripePaymentMethodSchema);
