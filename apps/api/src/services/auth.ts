/**
 * Auth Service
 * JWT Authentication with bcrypt
 * Production-ready with proper types
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { cache, cacheKeys, cacheTTL } from '../db/redis';
import {
    LeanUser,
    AuthTokens,
    JWTPayload,
    RefreshTokenPayload,
    OnboardingInput,
} from '../types';

// JWT expiry constants (production config)
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export const authService = {
    /**
     * Register new user
     */
    async signup(email: string, password: string, name: string): Promise<LeanUser> {
        // Check existing
        const exists = await User.findOne({ email });
        if (exists) {
            throw new Error('Email already registered');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

        // Create user with default dynamic roles
        const user = await User.create({
            email,
            password: hashedPassword,
            name,
            dynamicRoles: [
                { role: 'FRONTEND', weight: 0.5 },
                { role: 'BACKEND', weight: 0.3 },
                { role: 'DEVOPS', weight: 0.2 },
            ],
            verificationToken,
            verificationTokenExpires,
            isEmailVerified: false,
        });

        // Send welcome + verification emails
        const { emailService } = await import('./email.js');
        const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;

        // Send both emails (non-blocking)
        Promise.all([
            emailService.sendWelcome(email, name),
            emailService.sendVerification(email, name, verificationUrl),
        ]).catch(err => logger.error('Failed to send signup emails:', err));

        logger.info(`New user registered: ${email}`);

        return user.toObject() as LeanUser;
    },

    /**
     * Login user
     */
    async login(email: string, password: string): Promise<{ user: LeanUser; tokens: AuthTokens }> {
        email = email.toLowerCase().trim();
        const user = await User.findOne({ email, isActive: true });

        if (!user) {
            throw new Error('Invalid credentials');
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        // Update last active
        user.lastActiveAt = new Date();
        await user.save();

        const leanUser = user.toObject() as LeanUser;
        const tokens = this.generateTokens(leanUser);
        logger.info(`User logged in: ${email}`);

        return { user: leanUser, tokens };
    },

    /**
     * Generate JWT tokens
     */
    generateTokens(user: LeanUser): AuthTokens {
        const payload: JWTPayload = {
            userId: user._id.toString(),
            email: user.email,
        };

        const accessToken = jwt.sign(payload, config.jwtSecret, {
            expiresIn: ACCESS_TOKEN_EXPIRY,
        });

        const refreshPayload: RefreshTokenPayload = {
            ...payload,
            tokenVersion: user.tokenVersion,
        };

        const refreshToken = jwt.sign(refreshPayload, config.jwtSecret, {
            expiresIn: REFRESH_TOKEN_EXPIRY,
        });

        return { accessToken, refreshToken };
    },

    /**
     * Refresh access token
     */
    async refreshToken(token: string): Promise<AuthTokens> {
        try {
            const decoded = jwt.verify(token, config.jwtSecret) as RefreshTokenPayload;

            const user = await User.findById(decoded.userId);
            if (!user || user.tokenVersion !== decoded.tokenVersion) {
                throw new Error('Invalid refresh token');
            }

            return this.generateTokens(user.toObject() as LeanUser);
        } catch {
            throw new Error('Invalid refresh token');
        }
    },

    /**
     * Get user by ID (with caching)
     */
    async getUserById(userId: string): Promise<LeanUser | null> {
        // Check cache first
        const cacheKey = cacheKeys.userProfile(userId);
        const cached = await cache.get<LeanUser>(cacheKey);
        if (cached) return cached;

        // Fetch from DB - lean() returns plain object
        const user = await User.findById(userId).lean<LeanUser>();
        if (user) {
            await cache.set(cacheKey, user, cacheTTL.userProfile);
        }

        return user;
    },

    /**
     * Logout - invalidate tokens
     */
    async logout(userId: string): Promise<void> {
        await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
        await cache.del(cacheKeys.userProfile(userId));
        logger.info(`User logged out: ${userId}`);
    },

    /**
     * Verify email with token
     */
    async verifyEmail(token: string): Promise<boolean> {
        const user = await User.findOne({
            verificationToken: token,
            verificationTokenExpires: { $gt: new Date() },
        });

        if (!user) {
            throw new Error('Invalid or expired verification token');
        }

        user.isEmailVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
        await user.save();

        await cache.del(cacheKeys.userProfile(user._id.toString()));
        logger.info(`Email verified for user: ${user.email}`);

        return true;
    },

    /**
     * Request password reset - generates token and sends email
     */
    async requestPasswordReset(email: string): Promise<boolean> {
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // Don't reveal if email exists
            logger.info(`Password reset requested for unknown email: ${email}`);
            return true;
        }

        // Check if OAuth user (no password to reset)
        if (user.authProvider !== 'local' && !user.password) {
            logger.info(`Password reset requested for OAuth user: ${email}`);
            return true;
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        user.passwordResetToken = resetToken;
        user.passwordResetExpires = resetExpires;
        await user.save();

        // Send reset email
        const { emailService } = await import('./email.js');
        const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;

        await emailService.sendPasswordReset(user.email, user.name, resetUrl);

        logger.info(`Password reset token generated for: ${email}`);
        return true;
    },

    /**
     * Reset password with token
     */
    async resetPassword(token: string, newPassword: string): Promise<boolean> {
        const user = await User.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: new Date() },
        });

        if (!user) {
            throw new Error('Invalid or expired reset token');
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        user.password = hashedPassword;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all sessions

        await user.save();

        // Clear cache
        await cache.del(cacheKeys.userProfile(user._id.toString()));

        logger.info(`Password reset completed for: ${user.email}`);
        return true;
    },

    /**
     * Resend verification email
     */
    async resendVerificationEmail(userId: string): Promise<boolean> {
        const user = await User.findById(userId);

        if (!user) {
            throw new Error('User not found');
        }

        if (user.isEmailVerified) {
            throw new Error('Email already verified');
        }

        // Generate new token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

        user.verificationToken = verificationToken;
        user.verificationTokenExpires = verificationTokenExpires;
        await user.save();

        // Send email
        const { emailService } = await import('./email.js');
        const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;

        await emailService.sendVerification(user.email, user.name, verificationUrl);

        logger.info(`Verification email resent for: ${user.email}`);
        return true;
    },

    /**
     * Complete onboarding
     */
    async completeOnboarding(userId: string, input: OnboardingInput): Promise<LeanUser> {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        // Update profile
        user.dynamicRoles = input.dynamicRoles;
        user.preferences.skillLevel = input.skillLevel;
        user.preferences.interests = input.interests;
        user.preferences.preferredTags = input.preferredTags;
        user.onboardingCompleted = true;
        user.onboardingCompletedAt = new Date();

        await user.save();

        // Invalidate caches
        await cache.del(cacheKeys.userProfile(userId));
        await cache.delPattern(`feed:user:${userId}:*`);

        logger.info(`Onboarding completed for user: ${userId}`);

        return user.toObject() as LeanUser;
    },
};

export type { AuthTokens };
