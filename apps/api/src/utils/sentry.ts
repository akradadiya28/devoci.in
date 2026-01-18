/**
 * Sentry Error Tracking Integration
 * Initialize this FIRST in your application
 */

import * as Sentry from '@sentry/node';
import { Express } from 'express';
import { config, isProd } from './config';
import { logger } from './logger';

// Initialize Sentry (only if DSN is configured)
export function initSentry(): void {
    const dsn = process.env.SENTRY_DSN;

    if (!dsn) {
        logger.info('Sentry: Not configured (no SENTRY_DSN)');
        return;
    }

    Sentry.init({
        dsn,
        environment: config.nodeEnv,
        release: process.env.npm_package_version || '1.0.0',

        // Send default PII data (IP, user info)
        sendDefaultPii: true,

        // Performance monitoring
        tracesSampleRate: isProd ? 0.1 : 1.0, // 10% in prod, 100% in dev

        // Filter out noise
        ignoreErrors: [
            'Invalid credentials',
            'Email already registered',
            'Token expired',
            'Not authenticated',
        ],

        // Before sending, scrub sensitive data
        beforeSend(event) {
            if (event.breadcrumbs) {
                event.breadcrumbs = event.breadcrumbs.map(crumb => {
                    if (crumb.data?.password) {
                        crumb.data.password = '[REDACTED]';
                    }
                    return crumb;
                });
            }
            return event;
        },
    });

    logger.info('Sentry: Initialized for error tracking');
}

// Setup Express error handler (call AFTER all routes)
export function setupSentryErrorHandler(app: Express): void {
    if (!process.env.SENTRY_DSN) return;
    Sentry.setupExpressErrorHandler(app);
    logger.info('Sentry: Express error handler installed');
}

// Helper to capture errors with context
export function captureError(error: Error, context?: Record<string, any>): void {
    if (!process.env.SENTRY_DSN) return;

    Sentry.withScope(scope => {
        if (context) {
            Object.entries(context).forEach(([key, value]) => {
                scope.setExtra(key, value);
            });
        }
        Sentry.captureException(error);
    });
}

// Helper to set user context
export function setUserContext(userId: string, email?: string): void {
    if (!process.env.SENTRY_DSN) return;
    Sentry.setUser({ id: userId, email });
}

// Helper to clear user context (on logout)
export function clearUserContext(): void {
    if (!process.env.SENTRY_DSN) return;
    Sentry.setUser(null);
}

// Flush before shutdown
export async function flushSentry(): Promise<void> {
    if (!process.env.SENTRY_DSN) return;
    await Sentry.close(2000);
}

export { Sentry };

