/**
 * MongoDB Connection with Connection Pooling
 * Optimized for 1000+ concurrent users
 */

import mongoose from 'mongoose';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

// Connection options with pooling (as per backend.md)
const mongoOptions: mongoose.ConnectOptions = {
    minPoolSize: config.mongoPoolMin,  // 10 persistent connections
    maxPoolSize: config.mongoPoolMax,  // 50 max connections
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    w: 'majority',
};

let isConnected = false;

export async function connectDB(): Promise<typeof mongoose> {
    if (isConnected) {
        logger.debug('Using existing MongoDB connection');
        return mongoose;
    }

    try {
        const conn = await mongoose.connect(config.mongoUri, mongoOptions);
        isConnected = true;

        logger.info(`✅ MongoDB connected: ${conn.connection.host}`);
        logger.info(`   Pool size: ${config.mongoPoolMin}-${config.mongoPoolMax}`);

        // Connection event handlers
        mongoose.connection.on('error', (err) => {
            logger.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected. Attempting to reconnect...');
            isConnected = false;
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected');
            isConnected = true;
        });

        return conn;
    } catch (error) {
        logger.error('❌ MongoDB connection failed:', error);
        throw error;
    }
}

export async function disconnectDB(): Promise<void> {
    if (!isConnected) return;

    await mongoose.connection.close();
    isConnected = false;
    logger.info('MongoDB connection closed');
}

export { mongoose };
