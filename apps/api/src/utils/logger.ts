/**
 * Logger Utility
 * Winston-based logging with proper levels
 */

import winston from 'winston';
import { config, isDev } from './config';

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    isDev
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
                return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
        )
        : winston.format.json()
);

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    format: logFormat,
    defaultMeta: { service: 'devoci-api' },
    transports: [
        new winston.transports.Console(),
        // Add file transport in production
        ...(config.nodeEnv === 'production'
            ? [
                new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/combined.log' }),
            ]
            : []),
    ],
});

// Stream for Morgan (HTTP request logging)
export const loggerStream = {
    write: (message: string): void => {
        logger.http(message.trim());
    },
};
