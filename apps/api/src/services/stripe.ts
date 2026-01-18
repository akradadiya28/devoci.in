/**
 * Stripe Service
 * Handles all Stripe API interactions
 */

import Stripe from 'stripe';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { User, StripeCustomer, StripeSubscription, StripeInvoice } from '../models';
import { emailService } from './email';

// Initialize Stripe client
// Initialize Stripe client (only if key is present)
const stripeKey = config.stripeSecretKey;
const stripe = stripeKey
    ? new Stripe(stripeKey, { apiVersion: '2025-10-24.beta.v1' as any }) // Use latest or suppress version check
    : null;

if (!stripe) {
    logger.warn('⚠️ Stripe API key missing. Billing features will be disabled.');
}

export const stripeService = {
    /**
     * Get or create a Stripe Customer for a user
     */
    async getOrCreateCustomer(userId: string): Promise<string> {
        // Check if customer already exists
        const existing = await StripeCustomer.findOne({ userId });
        if (existing) {
            return existing.stripeCustomerId;
        }

        // Get user details
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        // Create Stripe customer
        if (!stripe) throw new Error('Stripe not configured');

        const customer = await stripe.customers.create({
            email: user.email,
            name: user.name,
            metadata: { userId: user._id.toString() },
        });

        // Save mapping
        await StripeCustomer.create({
            userId,
            stripeCustomerId: customer.id,
            email: user.email,
        });

        // Update user
        user.stripeCustomerId = customer.id;
        await user.save();

        logger.info(`Created Stripe customer ${customer.id} for user ${userId}`);
        return customer.id;
    },

    /**
     * Create a Checkout Session for subscription
     */
    async createCheckoutSession(
        userId: string,
        priceId: string,
        successUrl: string,
        cancelUrl: string
    ): Promise<string> {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        // Check if already premium
        if (user.plan === 'premium' && user.currentSubscriptionStatus === 'active') {
            throw new Error('User already has an active subscription');
        }

        // Get or create customer
        const customerId = await this.getOrCreateCustomer(userId);

        // Create checkout session
        if (!stripe) throw new Error('Stripe not configured');

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: { userId: user._id.toString() },
            billing_address_collection: 'required',
            allow_promotion_codes: true,
        });

        logger.info(`Created checkout session ${session.id} for user ${userId}`);
        return session.id;
    },

    /**
     * Cancel a subscription
     */
    async cancelSubscription(userId: string): Promise<void> {
        const subscription = await StripeSubscription.findOne({
            userId,
            status: { $in: ['active', 'past_due', 'trialing'] },
        });

        if (!subscription) {
            throw new Error('No active subscription found');
        }

        // Cancel at period end (user keeps access until then)
        if (!stripe) throw new Error('Stripe not configured');

        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
        });

        // Update local record
        subscription.canceledAt = new Date();
        subscription.canceledReason = 'customer_requested';
        await subscription.save();

        // Update user
        const user = await User.findById(userId);
        if (user) {
            user.currentSubscriptionStatus = 'canceled';
            await user.save();
        }

        logger.info(`Canceled subscription for user ${userId}`);
    },

    /**
     * Handle Stripe Webhook Events
     */
    async handleWebhookEvent(event: Stripe.Event): Promise<void> {
        logger.info(`Processing Stripe event: ${event.type}`);

        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                await this.handleSubscriptionUpdate(subscription);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                await this.handleSubscriptionDeleted(subscription);
                break;
            }

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as Stripe.Invoice;
                await this.handleInvoicePaid(invoice);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                await this.handleInvoiceFailed(invoice);
                break;
            }

            default:
                logger.debug(`Unhandled event type: ${event.type}`);
        }
    },

    /**
     * Handle subscription create/update
     */
    async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
        const customerId = typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;

        const stripeCustomer = await StripeCustomer.findOne({ stripeCustomerId: customerId });
        if (!stripeCustomer) {
            logger.warn(`No customer mapping found for ${customerId}`);
            return;
        }

        const userId = stripeCustomer.userId;
        const priceId = subscription.items.data[0]?.price?.id || '';

        // Cast to any for period fields (SDK v20 type changes)
        const sub = subscription as any;

        // Upsert subscription record
        await StripeSubscription.findOneAndUpdate(
            { stripeSubscriptionId: subscription.id },
            {
                userId,
                stripeSubscriptionId: subscription.id,
                stripeCustomerId: customerId,
                priceId,
                status: subscription.status as any,
                currentPeriodStart: new Date((sub.current_period_start || sub.start_date || Date.now() / 1000) * 1000),
                currentPeriodEnd: new Date((sub.current_period_end || sub.ended_at || Date.now() / 1000 + 30 * 24 * 3600) * 1000),
            },
            { upsert: true, new: true }
        );

        // Update user
        const user = await User.findById(userId);
        if (user) {
            user.plan = subscription.status === 'active' ? 'premium' : 'free';
            user.isPremium = subscription.status === 'active';
            user.currentSubscriptionStatus = subscription.status as any;
            user.subscriptionRenewDate = new Date((sub.current_period_end || Date.now() / 1000 + 30 * 24 * 3600) * 1000);

            if (subscription.status === 'active' && !user.subscriptionStartDate) {
                user.subscriptionStartDate = new Date();
            }

            await user.save();
        }

        // Send welcome email for new subscriptions
        if (subscription.status === 'active' && user) {
            await emailService.sendTemplate(user.email, 'welcome', {
                userName: user.name,
            });
        }

        logger.info(`Updated subscription ${subscription.id} for user ${userId}`);
    },

    /**
     * Handle subscription deletion
     */
    async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
        const subRecord = await StripeSubscription.findOne({
            stripeSubscriptionId: subscription.id,
        });

        if (!subRecord) return;

        subRecord.status = 'ended';
        subRecord.canceledAt = new Date();
        await subRecord.save();

        // Revoke premium access
        const user = await User.findById(subRecord.userId);
        if (user) {
            user.plan = 'free';
            user.isPremium = false;
            user.currentSubscriptionStatus = 'none';
            user.subscriptionEndDate = new Date();
            await user.save();

            // Send cancellation email
            await emailService.sendTemplate(user.email, 'subscriptionCanceled', {
                userName: user.name,
            });
        }

        logger.info(`Subscription ended for user ${subRecord.userId}`);
    },

    /**
     * Handle successful invoice payment
     */
    async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
        const inv = invoice as any;
        if (!inv.subscription) return;

        const subId = typeof inv.subscription === 'string'
            ? inv.subscription
            : inv.subscription.id;

        const subRecord = await StripeSubscription.findOne({
            stripeSubscriptionId: subId,
        });

        if (!subRecord) return;

        // Create invoice record
        await StripeInvoice.create({
            userId: subRecord.userId,
            stripeInvoiceId: invoice.id,
            stripeSubscriptionId: subId,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: 'paid',
            paidAt: new Date(),
            pdfUrl: invoice.hosted_invoice_url || undefined,
        });

        logger.info(`Invoice ${invoice.id} paid for user ${subRecord.userId}`);
    },

    /**
     * Handle failed invoice payment
     */
    async handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
        const inv = invoice as any;
        if (!inv.subscription) return;

        const subId = typeof inv.subscription === 'string'
            ? inv.subscription
            : inv.subscription.id;

        const subRecord = await StripeSubscription.findOne({
            stripeSubscriptionId: subId,
        });

        if (!subRecord) return;

        // Update subscription status
        subRecord.status = 'past_due';
        await subRecord.save();

        // Update user
        const user = await User.findById(subRecord.userId);
        if (user) {
            user.currentSubscriptionStatus = 'past_due';
            await user.save();

            // Send payment failed email
            await emailService.sendTemplate(user.email, 'paymentFailed', {
                userName: user.name,
            });
        }

        logger.info(`Invoice ${invoice.id} failed for user ${subRecord.userId}`);
    },

    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
        if (!stripe) throw new Error('Stripe not configured');

        return stripe.webhooks.constructEvent(
            payload,
            signature,
            config.stripeWebhookSecret || ''
        );
    },

    /**
     * Get user's invoices
     */
    async getUserInvoices(userId: string): Promise<any[]> {
        return StripeInvoice.find({ userId }).sort({ createdAt: -1 }).limit(12);
    },

    /**
     * Get subscription status
     */
    async getSubscriptionStatus(userId: string): Promise<any> {
        const user = await User.findById(userId);
        if (!user) return null;

        const subscription = await StripeSubscription.findOne({
            userId,
            status: { $in: ['active', 'past_due', 'trialing', 'canceled'] },
        });

        return {
            plan: user.plan,
            status: user.currentSubscriptionStatus,
            renewDate: user.subscriptionRenewDate,
            hasSubscription: !!subscription,
            subscription: subscription ? {
                id: subscription.stripeSubscriptionId,
                status: subscription.status,
                currentPeriodEnd: subscription.currentPeriodEnd,
            } : null,
        };
    },
};
