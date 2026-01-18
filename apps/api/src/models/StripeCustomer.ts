/**
 * Stripe Customer Model
 * Maps DevOci users to Stripe customers
 */

import { Schema, model, Document } from 'mongoose';

export interface IStripeCustomer extends Document {
    userId: string;
    stripeCustomerId: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

const stripeCustomerSchema = new Schema<IStripeCustomer>(
    {
        userId: { type: String, required: true, unique: true, index: true },
        stripeCustomerId: { type: String, required: true, unique: true },
        email: { type: String, required: true },
    },
    { timestamps: true }
);

export const StripeCustomer = model<IStripeCustomer>('StripeCustomer', stripeCustomerSchema);
