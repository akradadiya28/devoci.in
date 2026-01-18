/**
 * DevOci.in Backend Server
 * Node.js Clustering for Multi-Core Performance
 * Graceful Shutdown for Zero-Downtime Deployments
 */

import cluster from 'cluster';
import os from 'os';
import 'dotenv/config';

import express, { Express } from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';

import { config, isDev } from './utils';
import { logger } from './utils/logger';
import { connectDB, disconnectDB } from './db';
import { connectRedis, disconnectRedis } from './db/redis';
import { typeDefs, resolvers } from './graphql';
import { createContext } from './middleware';

// Import workers to start job processors
import './workers';

const numCPUs = config.workerCount || os.cpus().length;

/**
 * Master Process - Manages Workers
 */
function startMaster(): void {
    logger.info(`🚀 Master process ${process.pid} starting...`);
    logger.info(`   Spawning ${numCPUs} workers`);

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    // Handle worker exit
    cluster.on('exit', (worker, code, signal) => {
        logger.warn(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
        cluster.fork();
    });

    // Graceful shutdown for master
    process.on('SIGTERM', () => {
        logger.info('Master received SIGTERM. Shutting down workers...');
        for (const id in cluster.workers) {
            cluster.workers[id]?.process.kill('SIGTERM');
        }
    });
}

/**
 * Worker Process - Handles Requests
 */
async function startWorker(): Promise<void> {
    const workerId = cluster.worker?.id || 0;
    logger.info(`Worker ${workerId} (PID: ${process.pid}) starting...`);

    try {
        // Initialize Sentry first (error tracking)
        const { initSentry } = await import('./utils/sentry.js');
        initSentry();

        // Initialize Premium Features (if available)
        try {
            // @ts-ignore
            const { initGeminiProvider } = await import('./ee/services/ai.js');
            initGeminiProvider();
            logger.info('✨ Premium AI Features Initialized');
        } catch (e) {
            logger.debug('Running in Open Source mode (Premium features disabled)');
        }

        // Connect to databases
        await connectDB();
        await connectRedis();

        // Create Express app
        const app: Express = express();

        // Middleware
        app.use(cors({ origin: config.frontendUrl, credentials: true }));
        app.use(express.json({ limit: '10mb' }));

        // Rate Limiting (user-based, different limits per plan)
        const { userRateLimiter, endpointRateLimiter } = await import('./middleware/rateLimiter.js');
        app.use(userRateLimiter());
        app.use(endpointRateLimiter());

        // Health check endpoint
        app.get('/health', (_, res) => {
            res.json({
                status: 'ok',
                worker: workerId,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
            });
        });

        // Stripe Webhook (needs raw body BEFORE json middleware)
        // Note: This must use express.raw() for signature verification
        const { stripeService } = await import('./services/stripe.js');
        app.post(
            '/webhooks/stripe',
            express.raw({ type: 'application/json' }),
            async (req, res) => {
                const sig = req.headers['stripe-signature'] as string;

                try {
                    const event = stripeService.verifyWebhookSignature(req.body, sig);
                    await stripeService.handleWebhookEvent(event);
                    res.json({ received: true });
                } catch (err: any) {
                    logger.error('Stripe webhook error:', err.message);
                    res.status(400).send(`Webhook Error: ${err.message}`);
                }
            }
        );

        // OAuth Routes (Google, GitHub)
        const passport = (await import('passport')).default;
        const { oauthRouter } = await import('./routes/oauth.js');
        app.use(passport.initialize());
        app.use('/auth', oauthRouter);

        // Static files
        app.use(express.static('src/public'));

        // Apollo GraphQL Server
        const server = new ApolloServer({
            typeDefs,
            resolvers,
            introspection: isDev,
        });

        await server.start();

        // GraphQL endpoint
        app.use(
            '/graphql',
            expressMiddleware(server, {
                context: createContext,
            })
        );

        // Sentry test route (only in development)
        if (isDev) {
            app.get('/debug-sentry', () => {
                throw new Error('My first Sentry error!');
            });
        }

        // Setup Sentry error handler (AFTER all routes, BEFORE other error handlers)
        const { setupSentryErrorHandler } = await import('./utils/sentry.js');
        setupSentryErrorHandler(app);

        // Start HTTP server
        const httpServer = app.listen(config.port, () => {
            logger.info(`✅ Worker ${workerId} ready at http://localhost:${config.port}/graphql`);
        });

        // Graceful shutdown for worker
        const shutdown = async (signal: string): Promise<void> => {
            logger.info(`Worker ${workerId} received ${signal}. Graceful shutdown...`);

            // Stop accepting new connections
            httpServer.close(async () => {
                logger.info('HTTP server closed');

                // Cleanup
                await server.stop();
                await disconnectDB();
                await disconnectRedis();

                logger.info(`Worker ${workerId} shutdown complete`);
                process.exit(0);
            });

            // Force exit after timeout
            setTimeout(() => {
                logger.warn('Forcing shutdown after timeout');
                process.exit(1);
            }, 30000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
        logger.error('Worker failed to start:', error);
        process.exit(1);
    }
}

/**
 * Main Entry Point
 */
function main(): void {
    // In development, skip clustering for easier debugging
    if (isDev || !config.clusterEnabled) {
        logger.info('🔧 Development mode - running single process');
        startWorker();
        return;
    }

    // Production: Use clustering
    if (cluster.isPrimary) {
        startMaster();
    } else {
        startWorker();
    }
}

main();
