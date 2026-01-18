/**
 * Auth Resolvers
 * Production-ready with proper types
 */

import { authService } from '../../services';
import { GraphQLContext, requireAuth } from '../../middleware';
import { LeanUser } from '../../types';

export interface AuthPayload {
    user: LeanUser;
    accessToken: string;
    refreshToken: string;
}

export const authResolvers = {
    Query: {
        me: async (_: unknown, __: unknown, context: GraphQLContext): Promise<LeanUser | null> => {
            if (!context.user) return null;
            return authService.getUserById(context.user._id);
        },
    },

    Mutation: {
        signup: async (
            _: unknown,
            args: { email: string; password: string; name: string }
        ): Promise<AuthPayload> => {
            const user = await authService.signup(args.email, args.password, args.name);
            const tokens = authService.generateTokens(user);
            return {
                user,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            };
        },

        login: async (
            _: unknown,
            args: { email: string; password: string }
        ): Promise<AuthPayload> => {
            const { user, tokens } = await authService.login(args.email, args.password);
            return {
                user,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            };
        },

        refreshToken: async (
            _: unknown,
            args: { token: string }
        ): Promise<{ accessToken: string; refreshToken: string }> => {
            const tokens = await authService.refreshToken(args.token);
            return {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            };
        },

        logout: async (_: unknown, __: unknown, context: GraphQLContext): Promise<boolean> => {
            const user = requireAuth(context);
            await authService.logout(user._id);
            return true;
        },

        completeOnboarding: async (
            _: unknown,
            args: { input: any }, // Type matching OnboardingInput
            context: GraphQLContext
        ): Promise<LeanUser> => {
            const user = requireAuth(context);
            return authService.completeOnboarding(user._id, args.input);
        },

        verifyEmail: async (
            _: unknown,
            args: { token: string }
        ): Promise<boolean> => {
            return authService.verifyEmail(args.token);
        },

        requestPasswordReset: async (
            _: unknown,
            args: { email: string }
        ): Promise<boolean> => {
            return authService.requestPasswordReset(args.email);
        },

        resetPassword: async (
            _: unknown,
            args: { token: string; newPassword: string }
        ): Promise<boolean> => {
            return authService.resetPassword(args.token, args.newPassword);
        },

        resendVerificationEmail: async (
            _: unknown,
            __: unknown,
            context: GraphQLContext
        ): Promise<boolean> => {
            const user = requireAuth(context);
            return authService.resendVerificationEmail(user._id);
        },
    },

    // Field resolvers
    User: {
        id: (user: LeanUser): string => user._id.toString(),
    },
};
