/**
 * GraphQL Context Builder
 * Creates context for each request with auth
 */

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export interface User {
    _id: string;
    email: string;
    name: string;
    roles: string[];
}

export interface GraphQLContext {
    req: Request;
    res: Response;
    user: User | null;
    token: string | null;
}

interface JWTPayload {
    userId: string;
    email: string;
}

export async function createContext({
    req,
    res,
}: {
    req: Request;
    res: Response;
}): Promise<GraphQLContext> {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader || null;

    let user: User | null = null;

    if (token) {
        try {
            const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;

            // In production, fetch user from database
            // For now, create minimal user from token
            user = {
                _id: decoded.userId,
                email: decoded.email,
                name: '',
                roles: [],
            };
        } catch (error) {
            logger.debug('Invalid token:', error);
        }
    }

    return { req, res, user, token };
}

/**
 * Auth check helper for resolvers
 */
export function requireAuth(context: GraphQLContext): User {
    if (!context.user) {
        throw new Error('Authentication required');
    }
    return context.user;
}

/**
 * Premium plan check helper for resolvers
 * Returns user after verifying they have premium access
 */
export async function requirePremium(context: GraphQLContext): Promise<any> {
    const user = requireAuth(context);

    // Fetch full user from DB to check plan
    const { User: UserModel } = await import('../models/index.js');
    const fullUser = await UserModel.findById(user._id);

    if (!fullUser) {
        throw new Error('User not found');
    }

    if (fullUser.plan !== 'premium' && fullUser.currentSubscriptionStatus !== 'active') {
        throw new Error('Premium subscription required. Upgrade to access this feature.');
    }

    return fullUser;
}

/**
 * Admin access check helper for resolvers
 * Returns user after verifying they have admin access
 */
export async function requireAdmin(context: GraphQLContext): Promise<any> {
    const user = requireAuth(context);

    // Fetch full user from DB to check admin status
    const { User: UserModel } = await import('../models/index.js');
    const fullUser = await UserModel.findById(user._id);

    if (!fullUser) {
        throw new Error('User not found');
    }

    if (!fullUser.isAdmin) {
        throw new Error('Admin access required');
    }

    return fullUser;
}
