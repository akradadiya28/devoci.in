/**
 * User Model
 * Dynamic Roles: weight-based system (not static roles)
 */

import { Schema, model, Document } from 'mongoose';

// Dynamic role with weight (per backend.md)
export interface DynamicRole {
    role: string;       // FRONTEND, BACKEND, DEVOPS, ML, MOBILE
    weight: number;     // 0.0 - 1.0 (sum should be ~1.0)
}

// Premium Settings
export interface PremiumSettings {
    focusModeEnabled: boolean;
    focusModeDarkTheme: boolean;
    focusModeFontSize: number;
    focusModeFontFamily: string;
    weeklyPlanDay: string;
    weeklyPlanTime: string;
    enableAIRecommendations: boolean;
    enableWeeklyEmails: boolean;
}

// User preferences
export interface UserPreferences {
    topics: string[];
    languages: string[];
    skillLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    interests?: string[];
    preferredTags?: string[];
}

// Learning Profile
export interface LearningProfile {
    weakTopics: { topic: string; count: number; lastUpdated: Date }[];
    strongTopics: { topic: string; count: number; lastUpdated: Date }[];
    learningGoals: string[];
}

export interface IUser extends Document {
    email: string;
    password: string;
    name: string;
    avatar?: string;

    // Dynamic role system (not static!)
    dynamicRoles: DynamicRole[];

    // User preferences
    preferences: UserPreferences;

    // Premium Data
    plan: 'free' | 'premium';
    premiumSettings?: PremiumSettings;
    learningProfile?: LearningProfile;

    // Auth
    tokenVersion: number;
    isActive: boolean;
    isPremium: boolean; // Kept for backward compatibility, sync with plan='premium'
    isAdmin: boolean; // Admin access flag

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
    lastActiveAt?: Date;

    // Onboarding & Status
    onboardingCompleted: boolean;
    onboardingCompletedAt?: Date;
    isEmailVerified: boolean;
    verificationToken?: string;
    verificationTokenExpires?: Date;

    // Password Reset
    passwordResetToken?: string;
    passwordResetExpires?: Date;

    // Stripe Billing
    stripeCustomerId?: string;
    currentSubscriptionStatus: 'active' | 'past_due' | 'unpaid' | 'canceled' | 'none';
    subscriptionStartDate?: Date;
    subscriptionEndDate?: Date;
    subscriptionRenewDate?: Date;
    billingCycle?: 'monthly' | 'annual';

    // OAuth Providers
    authProvider: 'local' | 'google' | 'github';
    googleId?: string;
    githubId?: string;
}

const dynamicRoleSchema = new Schema<DynamicRole>(
    {
        role: { type: String, required: true },
        weight: { type: Number, required: true, min: 0, max: 1 },
    },
    { _id: false }
);

const premiumSettingsSchema = new Schema<PremiumSettings>(
    {
        focusModeEnabled: { type: Boolean, default: false },
        focusModeDarkTheme: { type: Boolean, default: true },
        focusModeFontSize: { type: Number, default: 18 },
        focusModeFontFamily: { type: String, default: 'Inter' },
        weeklyPlanDay: { type: String, default: 'Monday' },
        weeklyPlanTime: { type: String, default: '09:00' },
        enableAIRecommendations: { type: Boolean, default: true },
        enableWeeklyEmails: { type: Boolean, default: true },
    },
    { _id: false }
);

const learningProfileSchema = new Schema<LearningProfile>(
    {
        weakTopics: [{
            topic: String,
            count: Number,
            lastUpdated: Date
        }],
        strongTopics: [{
            topic: String,
            count: Number,
            lastUpdated: Date
        }],
        learningGoals: [String],
    },
    { _id: false }
);

const userSchema = new Schema<IUser>(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: { type: String, required: true },
        name: { type: String, required: true, trim: true },
        avatar: { type: String },

        // Dynamic roles (computed weekly from engagement)
        dynamicRoles: {
            type: [dynamicRoleSchema],
            default: [
                { role: 'FRONTEND', weight: 0.5 },
                { role: 'BACKEND', weight: 0.3 },
                { role: 'DEVOPS', weight: 0.2 },
            ],
        },

        preferences: {
            topics: { type: [String], default: [] }, // Kept for legacy/compat
            languages: { type: [String], default: ['en'] },
            skillLevel: {
                type: String,
                enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
                default: 'BEGINNER',
            },
            // Mapped from onboarding interests/tags
            interests: { type: [String], default: [] },
            preferredTags: { type: [String], default: [] },
        },

        // Premium Data
        plan: {
            type: String,
            enum: ['free', 'premium'],
            default: 'free'
        },
        premiumSettings: { type: premiumSettingsSchema, default: () => ({}) },
        learningProfile: { type: learningProfileSchema, default: () => ({}) },

        tokenVersion: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
        isPremium: { type: Boolean, default: false },
        isAdmin: { type: Boolean, default: false },
        lastActiveAt: { type: Date },

        // Onboarding & Status
        onboardingCompleted: { type: Boolean, default: false },
        onboardingCompletedAt: { type: Date },
        isEmailVerified: { type: Boolean, default: false },
        verificationToken: { type: String },
        verificationTokenExpires: { type: Date },

        // Stripe Billing
        stripeCustomerId: { type: String },
        currentSubscriptionStatus: {
            type: String,
            enum: ['active', 'past_due', 'unpaid', 'canceled', 'none'],
            default: 'none'
        },
        subscriptionStartDate: { type: Date },
        subscriptionEndDate: { type: Date },
        subscriptionRenewDate: { type: Date },
        billingCycle: { type: String, enum: ['monthly', 'annual'] },

        // OAuth Providers
        authProvider: {
            type: String,
            enum: ['local', 'google', 'github'],
            default: 'local'
        },
        googleId: { type: String, sparse: true },
        githubId: { type: String, sparse: true },

        // Password Reset
        passwordResetToken: { type: String },
        passwordResetExpires: { type: Date },
    },
    { timestamps: true }
);

// Indexes (email index created by unique:true)
userSchema.index({ 'dynamicRoles.role': 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ plan: 1 }); // Optimization for billing checks

export const User = model<IUser>('User', userSchema);
