/**
 * Email Service
 * Handles email sending with templates
 * Supports multiple providers (Resend, SendGrid, etc.)
 */

import { logger } from '../utils/logger';

// Email types
export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export interface EmailProvider {
    send(options: EmailOptions): Promise<boolean>;
    isConfigured(): boolean;
}

// Email template types
export type EmailTemplate =
    | 'welcome'
    | 'verification'
    | 'passwordReset'
    | 'weeklyDigest'
    | 'newArticles'
    | 'subscriptionCanceled'
    | 'paymentFailed';

export interface TemplateData {
    userName?: string;
    verificationUrl?: string;
    resetUrl?: string;
    articles?: Array<{
        title: string;
        url: string;
        description: string;
    }>;
    unsubscribeUrl?: string;
}

// Console logger provider (development)
const consoleProvider: EmailProvider = {
    async send(options: EmailOptions): Promise<boolean> {
        logger.info('📧 Email (console):', {
            to: options.to,
            subject: options.subject,
        });
        logger.debug('Email content:', options.html.substring(0, 200) + '...');
        return true;
    },

    isConfigured(): boolean {
        return true;
    },
};

// Resend provider (production - premium)
import { Resend } from 'resend';
import { config } from '../utils/config';

const createResendProvider = (): EmailProvider => {
    // Only initialize Resend if API key is present
    const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

    return {
        async send(options: EmailOptions): Promise<boolean> {
            if (!resend) return false;

            try {
                const result = await resend.emails.send({
                    from: config.emailFrom,
                    to: options.to,
                    subject: options.subject,
                    html: options.html,
                    text: options.text,
                });

                if (result.error) {
                    logger.error('Resend error:', result.error);
                    return false;
                }

                logger.info('📧 Email sent via Resend:', {
                    to: options.to,
                    subject: options.subject,
                    id: result.data?.id,
                });
                return true;
            } catch (error) {
                logger.error('Resend send failed:', error);
                return false;
            }
        },

        isConfigured(): boolean {
            return !!config.resendApiKey && config.resendApiKey.length > 0;
        },
    };
};

// Gmail SMTP provider (using Nodemailer)
import nodemailer from 'nodemailer';

const createGmailProvider = (): EmailProvider => {
    const gmailUser = config.gmailUser;
    const gmailPassword = config.gmailAppPassword;

    if (!gmailUser || !gmailPassword) {
        return {
            async send(): Promise<boolean> { return false; },
            isConfigured(): boolean { return false; },
        };
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: gmailUser,
            pass: gmailPassword,
        },
    });

    return {
        async send(options: EmailOptions): Promise<boolean> {
            try {
                const result = await transporter.sendMail({
                    from: `DevOci <${gmailUser}>`,
                    to: options.to,
                    subject: options.subject,
                    html: options.html,
                    text: options.text,
                });

                logger.info('📧 Email sent via Gmail:', {
                    to: options.to,
                    subject: options.subject,
                    messageId: result.messageId,
                });
                return true;
            } catch (error) {
                logger.error('Gmail send failed:', error);
                return false;
            }
        },

        isConfigured(): boolean {
            return !!gmailUser && !!gmailPassword;
        },
    };
};

// Auto-select provider: Resend > Gmail > Console
const resendProvider = createResendProvider();
const gmailProvider = createGmailProvider();

let currentProvider: EmailProvider;
if (resendProvider.isConfigured()) {
    currentProvider = resendProvider;
    logger.info('📧 Email: Using Resend provider');
} else if (gmailProvider.isConfigured()) {
    currentProvider = gmailProvider;
    logger.info('📧 Email: Using Gmail SMTP provider');
} else {
    currentProvider = consoleProvider;
    logger.info('📧 Email: Using Console provider (no email service configured)');
}

/**
 * Email Templates
 */
const templates = {
    welcome: (data: TemplateData): { subject: string; html: string } => ({
        subject: 'Welcome to DevOci.in! 🚀',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to DevOci.in!</h1>
        </div>
        <div class="content">
            <p>Hi ${data.userName || 'Developer'},</p>
            <p>Thanks for joining DevOci.in - your personalized developer news feed!</p>
            <p>Here's what you can do:</p>
            <ul>
                <li>📰 Get personalized articles based on your interests</li>
                <li>🔖 Save articles for later reading</li>
                <li>📊 Track your reading patterns</li>
                <li>🎯 Discover content matching your skill level</li>
            </ul>
            <a href="https://devoci.in/feed" class="button">Start Reading →</a>
            <p>Happy coding!</p>
            <p>- The DevOci Team</p>
        </div>
        <div class="footer">
            <p>© 2026 DevOci.in | <a href="${data.unsubscribeUrl || '#'}">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>
        `.trim(),
    }),

    verification: (data: TemplateData): { subject: string; html: string } => ({
        subject: 'Verify your DevOci.in email',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 10px; }
        .button { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            <h2>Verify Your Email</h2>
            <p>Hi ${data.userName || 'there'},</p>
            <p>Please click the button below to verify your email address:</p>
            <a href="${data.verificationUrl}" class="button">Verify Email</a>
            <p>If you didn't create an account, you can ignore this email.</p>
            <p>This link expires in 24 hours.</p>
        </div>
    </div>
</body>
</html>
        `.trim(),
    }),

    passwordReset: (data: TemplateData): { subject: string; html: string } => ({
        subject: 'Reset your DevOci.in password',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 10px; }
        .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            <h2>Reset Your Password</h2>
            <p>Hi ${data.userName || 'there'},</p>
            <p>We received a request to reset your password. Click the button below:</p>
            <a href="${data.resetUrl}" class="button">Reset Password</a>
            <p>If you didn't request this, please ignore this email.</p>
            <p>This link expires in 1 hour.</p>
        </div>
    </div>
</body>
</html>
        `.trim(),
    }),

    weeklyDigest: (data: TemplateData): { subject: string; html: string } => ({
        subject: '🔥 Your Weekly DevOci.in Digest',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 20px; }
        .article { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea; }
        .article h3 { margin: 0 0 10px 0; }
        .article p { margin: 0; color: #666; font-size: 14px; }
        .article a { color: #667eea; text-decoration: none; }
        .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📰 Weekly Digest</h1>
            <p>Top articles curated for you</p>
        </div>
        <div class="content">
            <p>Hi ${data.userName || 'Developer'},</p>
            <p>Here are this week's top articles:</p>
            ${(data.articles || []).map(article => `
            <div class="article">
                <h3><a href="${article.url}">${article.title}</a></h3>
                <p>${article.description}</p>
            </div>
            `).join('')}
        </div>
        <div class="footer">
            <p>© 2026 DevOci.in | <a href="${data.unsubscribeUrl || '#'}">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>
        `.trim(),
    }),

    newArticles: (data: TemplateData): { subject: string; html: string } => ({
        subject: '📬 New articles matching your interests',
        html: templates.weeklyDigest(data).html.replace('Weekly Digest', 'New Articles'),
    }),

    subscriptionCanceled: (data: TemplateData): { subject: string; html: string } => ({
        subject: 'Your DevOci Premium Subscription Has Ended',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            <h2>Subscription Canceled</h2>
            <p>Hi ${data.userName || 'there'},</p>
            <p>Your DevOci Premium subscription has been canceled.</p>
            <p>You'll lose access to:</p>
            <ul>
                <li>AI-powered recommendations</li>
                <li>Weekly learning plans</li>
                <li>Focus mode</li>
                <li>Unlimited saved articles</li>
            </ul>
            <p>We'd love to have you back!</p>
            <a href="https://devoci.in/pricing" class="button">Resubscribe Now</a>
        </div>
    </div>
</body>
</html>
        `.trim(),
    }),

    paymentFailed: (data: TemplateData): { subject: string; html: string } => ({
        subject: '⚠️ Payment Failed - Update Your Card',
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .content { background: #fff3cd; padding: 30px; border-radius: 10px; border: 1px solid #ffc107; }
        .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            <h2>⚠️ Payment Failed</h2>
            <p>Hi ${data.userName || 'there'},</p>
            <p>We couldn't process your payment for DevOci Premium.</p>
            <p>Please update your payment method to continue using premium features.</p>
            <a href="https://devoci.in/settings/billing" class="button">Update Payment Method</a>
            <p>If you don't update within 7 days, your premium access will be suspended.</p>
        </div>
    </div>
</body>
</html>
        `.trim(),
    }),
};

/**
 * Email Service
 */
export const emailService = {
    /**
     * Send email using template
     */
    async sendTemplate(
        to: string,
        template: EmailTemplate,
        data: TemplateData = {}
    ): Promise<boolean> {
        try {
            if (!currentProvider.isConfigured()) {
                logger.warn('Email provider not configured');
                return false;
            }

            const { subject, html } = templates[template](data);

            return await currentProvider.send({
                to,
                subject,
                html,
            });

        } catch (error) {
            logger.error('Failed to send email', { error, to, template });
            return false;
        }
    },

    /**
     * Send raw email
     */
    async send(options: EmailOptions): Promise<boolean> {
        try {
            return await currentProvider.send(options);
        } catch (error) {
            logger.error('Failed to send email', { error });
            return false;
        }
    },

    /**
     * Send welcome email
     */
    async sendWelcome(to: string, userName: string): Promise<boolean> {
        return this.sendTemplate(to, 'welcome', { userName });
    },

    /**
     * Send verification email
     */
    async sendVerification(to: string, userName: string, verificationUrl: string): Promise<boolean> {
        return this.sendTemplate(to, 'verification', { userName, verificationUrl });
    },

    /**
     * Send password reset email
     */
    async sendPasswordReset(to: string, userName: string, resetUrl: string): Promise<boolean> {
        return this.sendTemplate(to, 'passwordReset', { userName, resetUrl });
    },

    /**
     * Send weekly digest
     */
    async sendWeeklyDigest(
        to: string,
        userName: string,
        articles: TemplateData['articles']
    ): Promise<boolean> {
        return this.sendTemplate(to, 'weeklyDigest', { userName, articles });
    },

    /**
     * Set email provider
     */
    setProvider(provider: EmailProvider): void {
        currentProvider = provider;
        logger.info('Email provider set');
    },

    /**
     * Check if email is configured
     */
    isConfigured(): boolean {
        return currentProvider.isConfigured();
    },
};
