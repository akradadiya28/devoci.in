/**
 * OAuth Routes
 * REST endpoints for Google and GitHub OAuth flow
 */

import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { config } from '../utils/config';
import { oauthService } from '../services/oauth';
import { logger } from '../utils/logger';

const router: RouterType = Router();

// Initialize Passport strategies
if (config.googleClientId && config.googleClientSecret) {
    passport.use(new GoogleStrategy(
        {
            clientID: config.googleClientId,
            clientSecret: config.googleClientSecret,
            callbackURL: `${config.frontendUrl}/api/auth/google/callback`,
        },
        async (_accessToken, _refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                if (!email) {
                    return done(new Error('No email from Google'), undefined);
                }

                const result = await oauthService.handleGoogleAuth({
                    id: profile.id,
                    email,
                    name: profile.displayName,
                    picture: profile.photos?.[0]?.value,
                });

                done(null, result);
            } catch (error) {
                done(error as Error, undefined);
            }
        }
    ));
    logger.info('Google OAuth strategy configured');
}

if (config.githubClientId && config.githubClientSecret) {
    passport.use(new GitHubStrategy(
        {
            clientID: config.githubClientId,
            clientSecret: config.githubClientSecret,
            callbackURL: `${config.frontendUrl}/api/auth/github/callback`,
            scope: ['user:email'],
        },
        async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
            try {
                const email = profile.emails?.[0]?.value || `${profile.username}@github.local`;

                const result = await oauthService.handleGithubAuth({
                    id: String(profile.id),
                    email,
                    name: profile.displayName || profile.username,
                    avatar_url: profile.photos?.[0]?.value,
                });

                done(null, result);
            } catch (error) {
                done(error as Error, undefined);
            }
        }
    ));
    logger.info('GitHub OAuth strategy configured');
}

// Serialize/deserialize for passport session (we don't use sessions, but needed)
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user: any, done) => done(null, user));

/**
 * Google OAuth Routes
 */
router.get('/google', (req: Request, res: Response, next) => {
    if (!config.googleClientId) {
        return res.status(501).json({ error: 'Google OAuth not configured' });
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login?error=google_failed' }),
    (req: Request, res: Response) => {
        const { tokens, isNewUser } = req.user as any;

        // Redirect to frontend with tokens
        const redirectUrl = new URL(`${config.frontendUrl}/auth/callback`);
        redirectUrl.searchParams.set('accessToken', tokens.accessToken);
        redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);
        redirectUrl.searchParams.set('isNewUser', String(isNewUser));

        res.redirect(redirectUrl.toString());
    }
);

/**
 * GitHub OAuth Routes
 */
router.get('/github', (req: Request, res: Response, next) => {
    if (!config.githubClientId) {
        return res.status(501).json({ error: 'GitHub OAuth not configured' });
    }
    passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
});

router.get('/github/callback',
    passport.authenticate('github', { session: false, failureRedirect: '/login?error=github_failed' }),
    (req: Request, res: Response) => {
        const { tokens, isNewUser } = req.user as any;

        // Redirect to frontend with tokens
        const redirectUrl = new URL(`${config.frontendUrl}/auth/callback`);
        redirectUrl.searchParams.set('accessToken', tokens.accessToken);
        redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);
        redirectUrl.searchParams.set('isNewUser', String(isNewUser));

        res.redirect(redirectUrl.toString());
    }
);

export const oauthRouter: RouterType = router;
