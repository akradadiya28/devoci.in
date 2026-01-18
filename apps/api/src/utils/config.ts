/**
 * Environment Configuration
 * All dynamic values from .env - nothing hardcoded
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (monorepo structure)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
// Load local .env (if any)
dotenv.config();

interface Config {
    // Server
    nodeEnv: string;
    port: number;
    websocketPort: number;

    // MongoDB
    mongoUri: string;
    mongoPoolMin: number;
    mongoPoolMax: number;

    // Redis
    redisUrl: string;

    // JWT
    jwtSecret: string;
    jwtExpiresIn: string;
    refreshTokenExpiresIn: string;

    // AI (Gemini)
    geminiApiKey: string;

    // Frontend
    frontendUrl: string;

    // Stripe (optional)
    stripeSecretKey?: string;
    stripeWebhookSecret?: string;

    // Email (Resend)
    resendApiKey: string;
    emailFrom: string;

    // Clustering
    clusterEnabled: boolean;
    workerCount: number;

    // OAuth
    googleClientId?: string;
    googleClientSecret?: string;
    githubClientId?: string;
    githubClientSecret?: string;

    // Push Notifications (VAPID)
    vapidPublicKey?: string;
    vapidPrivateKey?: string;

    // Gmail
    gmailUser?: string;
    gmailAppPassword?: string;
}

function getEnvVar(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (!value && defaultValue === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value || defaultValue || '';
}

function getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    return value ? parseInt(value, 10) : defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    return value ? value.toLowerCase() === 'true' : defaultValue;
}

export const config: Config = {
    // Server
    nodeEnv: getEnvVar('NODE_ENV', 'development'),
    port: getEnvNumber('PORT', 4000),
    websocketPort: getEnvNumber('WEBSOCKET_PORT', 5000),

    // MongoDB with pooling config
    mongoUri: getEnvVar('MONGODB_URI', 'mongodb://localhost:27017/devoci'),
    mongoPoolMin: getEnvNumber('MONGO_POOL_MIN', 10),
    mongoPoolMax: getEnvNumber('MONGO_POOL_MAX', 50),

    // Redis
    redisUrl: getEnvVar('REDIS_URL', 'redis://localhost:6379'),

    // JWT
    jwtSecret: getEnvVar('JWT_SECRET', 'dev-secret-change-in-production'),
    jwtExpiresIn: getEnvVar('JWT_EXPIRES_IN', '15m'),
    refreshTokenExpiresIn: getEnvVar('REFRESH_TOKEN_EXPIRES_IN', '7d'),

    // AI
    geminiApiKey: getEnvVar('GEMINI_API_KEY', ''),

    // Frontend
    frontendUrl: getEnvVar('FRONTEND_URL', 'http://localhost:3000'),

    // Stripe
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,

    // Email (Resend)
    resendApiKey: getEnvVar('RESEND_API_KEY', ''),
    emailFrom: getEnvVar('EMAIL_FROM', 'DevOci <noreply@devoci.in>'),

    // Clustering
    clusterEnabled: getEnvBoolean('CLUSTER_ENABLED', true),
    workerCount: getEnvNumber('WORKER_COUNT', 0), // 0 = use all CPUs

    // OAuth
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    githubClientId: process.env.GITHUB_CLIENT_ID,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET,

    // Push Notifications (VAPID)
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,

    // Gmail (Nodemailer Fallback)
    gmailUser: process.env.GMAIL_USER,
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD,
};

export const isDev = config.nodeEnv === 'development';
export const isProd = config.nodeEnv === 'production';
