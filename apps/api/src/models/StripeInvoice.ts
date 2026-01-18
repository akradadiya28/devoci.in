/**
 * Stripe Invoice Model
 * Stores invoice/receipt records
 */

import { Schema, model, Document } from 'mongoose';

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface IStripeInvoice extends Document {
    userId: string;
    stripeInvoiceId: string;
    stripeSubscriptionId: string;
    amount: number; // In smallest currency unit (paise for INR)
    currency: string;
    status: InvoiceStatus;
    paidAt?: Date;
    dueDate?: Date;
    pdfUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}

const stripeInvoiceSchema = new Schema<IStripeInvoice>(
    {
        userId: { type: String, required: true, index: true },
        stripeInvoiceId: { type: String, required: true, unique: true },
        stripeSubscriptionId: { type: String, required: true },
        amount: { type: Number, required: true },
        currency: { type: String, default: 'inr' },
        status: {
            type: String,
            enum: ['draft', 'open', 'paid', 'void', 'uncollectible'],
            default: 'open',
        },
        paidAt: { type: Date },
        dueDate: { type: Date },
        pdfUrl: { type: String },
    },
    { timestamps: true }
);



export const StripeInvoice = model<IStripeInvoice>('StripeInvoice', stripeInvoiceSchema);
