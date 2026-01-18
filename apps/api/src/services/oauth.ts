/**
 * OAuth Service
 * Handles Google and GitHub OAuth authentication
 */

import { User } from '../models';
import { authService } from './auth';
import { logger } from '../utils/logger';
import { LeanUser, AuthTokens } from '../types';

export interface OAuthProfile {
    provider: 'google' | 'github';
    providerId: string;
    email: string;
    name: string;
    avatar?: string;
}

export const oauthService = {
    /**
     * Find or create user from OAuth profile
     * Handles account linking if email already exists
     */
    async findOrCreateUser(profile: OAuthProfile): Promise<{ user: LeanUser; tokens: AuthTokens; isNewUser: boolean }> {
        const { provider, providerId, email, name, avatar } = profile;

        // Field name based on provider
        const providerIdField = provider === 'google' ? 'googleId' : 'githubId';

        // First, check if user exists with this provider ID
        let user = await User.findOne({ [providerIdField]: providerId });

        if (user) {
            // Existing OAuth user - just login
            user.lastActiveAt = new Date();
            await user.save();

            const leanUser = user.toObject() as LeanUser;
            const tokens = authService.generateTokens(leanUser);

            logger.info(`OAuth login: ${email} via ${provider}`);
            return { user: leanUser, tokens, isNewUser: false };
        }

        // Check if email already exists (local account or other OAuth)
        user = await User.findOne({ email: email.toLowerCase() });

        if (user) {
            // Link OAuth provider to existing account
            (user as any)[providerIdField] = providerId;
            if (!user.avatar && avatar) {
                user.avatar = avatar;
            }
            user.isEmailVerified = true; // OAuth emails are verified
            user.lastActiveAt = new Date();
            await user.save();

            const leanUser = user.toObject() as LeanUser;
            const tokens = authService.generateTokens(leanUser);

            logger.info(`OAuth linked: ${email} with ${provider}`);
            return { user: leanUser, tokens, isNewUser: false };
        }

        // Create new user
        user = await User.create({
            email: email.toLowerCase(),
            name,
            avatar,
            password: '', // OAuth users don't have passwords
            authProvider: provider,
            [providerIdField]: providerId,
            isEmailVerified: true, // OAuth emails are verified
            dynamicRoles: [
                { role: 'FRONTEND', weight: 0.5 },
                { role: 'BACKEND', weight: 0.3 },
                { role: 'DEVOPS', weight: 0.2 },
            ],
        });

        const leanUser = user.toObject() as LeanUser;
        const tokens = authService.generateTokens(leanUser);

        logger.info(`New OAuth user: ${email} via ${provider}`);
        return { user: leanUser, tokens, isNewUser: true };
    },

    /**
     * Handle Google OAuth callback
     */
    async handleGoogleAuth(googleProfile: {
        id: string;
        email: string;
        name: string;
        picture?: string;
    }): Promise<{ user: LeanUser; tokens: AuthTokens; isNewUser: boolean }> {
        return this.findOrCreateUser({
            provider: 'google',
            providerId: googleProfile.id,
            email: googleProfile.email,
            name: googleProfile.name,
            avatar: googleProfile.picture,
        });
    },

    /**
     * Handle GitHub OAuth callback
     */
    async handleGithubAuth(githubProfile: {
        id: string;
        email: string;
        name: string;
        avatar_url?: string;
    }): Promise<{ user: LeanUser; tokens: AuthTokens; isNewUser: boolean }> {
        return this.findOrCreateUser({
            provider: 'github',
            providerId: githubProfile.id,
            email: githubProfile.email,
            name: githubProfile.name || githubProfile.email.split('@')[0],
            avatar: githubProfile.avatar_url,
        });
    },
};
