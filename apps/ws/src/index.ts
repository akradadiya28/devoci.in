
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import winston from 'winston';

dotenv.config();

// --- Config ---
const PORT = process.env.PORT || 4001;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_in_prod';
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || '*';

// --- Logger ---
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [new winston.transports.Console()],
});

// --- Redis ---
const redisSub = new Redis(REDIS_URL);
const redisPub = new Redis(REDIS_URL); // For potential publishing (e.g. presence)

// --- Server Setup ---
const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
        origin: ALLOWED_ORIGIN,
        methods: ['GET', 'POST'],
    },
});

// --- Middleware: Auth ---
io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error: No token'));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        socket.data.userId = decoded.userId;
        next();
    } catch (err) {
        next(new Error('Authentication error: Invalid token'));
    }
});

// --- Connection Handler ---
io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    logger.info(`User connected: ${userId} (${socket.id})`);

    // Join Rooms
    socket.join(`user:${userId}`);
    socket.join('feed:global');

    // Handle Disconnect
    socket.on('disconnect', () => {
        logger.info(`User disconnected: ${userId}`);
    });
});

// --- Redis Event Listener ---
// Channels to subscribe
const CHANNELS = ['events:streak', 'events:milestone', 'events:article', 'events:notification'];

redisSub.subscribe(...CHANNELS, (err, count) => {
    if (err) {
        logger.error('Failed to subscribe: %s', err.message);
    } else {
        logger.info(`Subscribed to ${count} channels.`);
    }
});

redisSub.on('message', (channel, message) => {
    try {
        const payload = JSON.parse(message);
        logger.info(`Received event on [${channel}]`, payload);

        // Routing Logic
        handleEvent(channel, payload);
    } catch (error) {
        logger.error('Error processing message:', error);
    }
});

function handleEvent(channel: string, payload: any) {
    const { userId, type, data } = payload;

    switch (channel) {
        case 'events:streak':
            // Targeted to user
            if (userId) {
                io.to(`user:${userId}`).emit('streak_updated', data);
            }
            break;

        case 'events:milestone':
            // Targeted to user
            if (userId) {
                io.to(`user:${userId}`).emit('milestone_unlocked', data);
            }
            // Optional: global toast for big achievements?
            break;

        case 'events:notification':
            if (userId) {
                io.to(`user:${userId}`).emit('new_notification', data);
            }
            break;

        case 'events:article':
            // Global broadcast
            io.to('feed:global').emit('new_article', data);
            break;

        default:
            logger.warn(`Unknown channel: ${channel}`);
    }
}

// --- Start ---
httpServer.listen(PORT, () => {
    logger.info(`Real-Time Server running on port ${PORT}`);
});
