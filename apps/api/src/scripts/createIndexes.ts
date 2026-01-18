/**
 * Database Indexes Script
 * Run this script to create all necessary indexes for optimal performance
 * 
 * Usage: npx tsx src/scripts/createIndexes.ts
 */

import mongoose from 'mongoose';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

const indexes = [
    // Users
    { collection: 'users', index: { email: 1 }, options: { unique: true } },
    { collection: 'users', index: { stripeCustomerId: 1 }, options: { sparse: true } },
    { collection: 'users', index: { googleId: 1 }, options: { sparse: true } },
    { collection: 'users', index: { githubId: 1 }, options: { sparse: true } },
    { collection: 'users', index: { isAdmin: 1 }, options: {} },
    { collection: 'users', index: { plan: 1 }, options: {} },
    { collection: 'users', index: { createdAt: -1 }, options: {} },
    { collection: 'users', index: { lastActiveAt: -1 }, options: {} },
    { collection: 'users', index: { 'dynamicRoles.role': 1 }, options: {} },

    // Articles
    { collection: 'articles', index: { url: 1 }, options: { unique: true } },
    { collection: 'articles', index: { createdAt: -1 }, options: {} },
    { collection: 'articles', index: { publishedAt: -1 }, options: {} },
    { collection: 'articles', index: { qualityScore: -1 }, options: {} },
    { collection: 'articles', index: { sourceId: 1 }, options: {} },
    { collection: 'articles', index: { sourceName: 1 }, options: {} },
    { collection: 'articles', index: { isActive: 1, createdAt: -1 }, options: {} },
    { collection: 'articles', index: { tags: 1 }, options: {} },
    { collection: 'articles', index: { 'targetRoles.role': 1, 'targetRoles.weight': -1 }, options: {} },
    { collection: 'articles', index: { title: 'text', description: 'text' }, options: { name: 'article_text_search' } },

    // Engagements
    { collection: 'engagements', index: { userId: 1, createdAt: -1 }, options: {} },
    { collection: 'engagements', index: { articleId: 1 }, options: {} },
    { collection: 'engagements', index: { userId: 1, articleId: 1, type: 1 }, options: {} },
    { collection: 'engagements', index: { type: 1, createdAt: -1 }, options: {} },

    // Saved Articles
    { collection: 'savedarticles', index: { userId: 1, createdAt: -1 }, options: {} },
    { collection: 'savedarticles', index: { userId: 1, articleId: 1 }, options: { unique: true } },

    // Notifications
    { collection: 'notifications', index: { userId: 1, createdAt: -1 }, options: {} },
    { collection: 'notifications', index: { userId: 1, isRead: 1 }, options: {} },

    // Push Subscriptions
    { collection: 'pushsubscriptions', index: { userId: 1 }, options: {} },
    { collection: 'pushsubscriptions', index: { endpoint: 1 }, options: { unique: true } },

    // User Streaks
    { collection: 'userstreaks', index: { userId: 1 }, options: { unique: true } },
    { collection: 'userstreaks', index: { currentStreak: -1 }, options: {} },
    { collection: 'userstreaks', index: { longestStreak: -1 }, options: {} },

    // User Milestones
    { collection: 'usermilestones', index: { userId: 1 }, options: {} },
    { collection: 'usermilestones', index: { type: 1 }, options: {} },

    // User Badges
    { collection: 'userbadges', index: { userId: 1 }, options: {} },
    { collection: 'userbadges', index: { badgeId: 1 }, options: {} },

    // Weekly Stats
    { collection: 'weeklystats', index: { userId: 1, weekStart: -1 }, options: {} },

    // Weekly Plans (Premium)
    { collection: 'weeklyplans', index: { userId: 1, weekStart: -1 }, options: {} },
    { collection: 'weeklyplans', index: { userId: 1, status: 1 }, options: {} },

    // Smart Collections (Premium)
    { collection: 'smartcollections', index: { userId: 1 }, options: {} },
    { collection: 'smartcollections', index: { type: 1 }, options: {} },

    // Learning Gaps (Premium)
    { collection: 'learninggaps', index: { userId: 1 }, options: { unique: true } },

    // Stripe Tables
    { collection: 'stripecustomers', index: { userId: 1 }, options: { unique: true } },
    { collection: 'stripecustomers', index: { stripeCustomerId: 1 }, options: { unique: true } },
    { collection: 'stripesubscriptions', index: { userId: 1 }, options: {} },
    { collection: 'stripesubscriptions', index: { stripeSubscriptionId: 1 }, options: { unique: true } },
    { collection: 'stripesubscriptions', index: { status: 1 }, options: {} },
    { collection: 'stripeinvoices', index: { userId: 1, createdAt: -1 }, options: {} },
    { collection: 'stripeinvoices', index: { stripeInvoiceId: 1 }, options: { unique: true } },
    { collection: 'stripepaymentmethods', index: { userId: 1 }, options: {} },

    // RSS Sources
    { collection: 'rsssources', index: { url: 1 }, options: { unique: true } },
    { collection: 'rsssources', index: { isActive: 1 }, options: {} },
];

async function createIndexes(): Promise<void> {
    try {
        logger.info('Connecting to MongoDB...');
        await mongoose.connect(config.mongoUri);
        logger.info('Connected to MongoDB');

        const db = mongoose.connection.db;
        if (!db) {
            throw new Error('Database connection not established');
        }

        let created = 0;
        let skipped = 0;
        let errors = 0;

        for (const { collection, index, options } of indexes) {
            try {
                await db.collection(collection).createIndex(index as any, options);
                logger.info(`✅ Created index on ${collection}: ${JSON.stringify(index)}`);
                created++;
            } catch (error: any) {
                if (error.code === 85 || error.code === 86) {
                    // Index already exists with different options, or name conflict
                    logger.warn(`⚠️ Index already exists on ${collection}: ${JSON.stringify(index)}`);
                    skipped++;
                } else if (error.codeName === 'IndexOptionsConflict') {
                    logger.warn(`⚠️ Index options conflict on ${collection}: ${JSON.stringify(index)}`);
                    skipped++;
                } else {
                    logger.error(`❌ Failed to create index on ${collection}:`, error.message);
                    errors++;
                }
            }
        }

        logger.info('');
        logger.info('========================================');
        logger.info(`Index creation complete!`);
        logger.info(`  ✅ Created: ${created}`);
        logger.info(`  ⚠️ Skipped: ${skipped}`);
        logger.info(`  ❌ Errors: ${errors}`);
        logger.info('========================================');

    } catch (error) {
        logger.error('Failed to create indexes:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        logger.info('Disconnected from MongoDB');
    }
}

// Run if executed directly
createIndexes();
