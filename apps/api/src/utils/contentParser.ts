/**
 * Content Parser
 * Clean HTML, extract text, find best images
 * Production-ready content processing
 */

import * as cheerio from 'cheerio';

export interface ParsedContent {
    text: string;           // Clean text content
    description: string;    // First 300 chars for description
    imageUrl?: string;      // Best image found
    wordCount: number;
}

/**
 * Parse and clean HTML content
 */
export function parseHtmlContent(html: string): ParsedContent {
    if (!html) {
        return { text: '', description: '', wordCount: 0 };
    }

    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, noscript, iframe, nav, footer, header, aside, .ad, .advertisement, .social-share').remove();

    // Find best image
    const imageUrl = findBestImage($);

    // Get clean text
    const text = $.root().text()
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();

    // Create description (first 300 chars, word boundary)
    const description = createDescription(text, 300);

    // Word count
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    return {
        text,
        description,
        imageUrl,
        wordCount,
    };
}

/**
 * Find best image from HTML
 * Priority: og:image > article image > first large image
 */
function findBestImage($: cheerio.CheerioAPI): string | undefined {
    // 1. Try Open Graph image
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage && isValidImageUrl(ogImage)) {
        return normalizeImageUrl(ogImage);
    }

    // 2. Try Twitter image
    const twitterImage = $('meta[name="twitter:image"]').attr('content');
    if (twitterImage && isValidImageUrl(twitterImage)) {
        return normalizeImageUrl(twitterImage);
    }

    // 3. Try article/main content images
    const articleImages = $('article img, .content img, .post img, main img');
    for (let i = 0; i < articleImages.length; i++) {
        const src = $(articleImages[i]).attr('src');
        if (src && isValidImageUrl(src) && !isSmallImage(src)) {
            return normalizeImageUrl(src);
        }
    }

    // 4. Try any image
    const allImages = $('img');
    for (let i = 0; i < allImages.length; i++) {
        const src = $(allImages[i]).attr('src');
        if (src && isValidImageUrl(src) && !isSmallImage(src)) {
            return normalizeImageUrl(src);
        }
    }

    return undefined;
}

/**
 * Create description from text (word boundary aware)
 */
function createDescription(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    // Find last space before maxLength
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.7) {
        return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
}

/**
 * Check if URL is a valid image URL
 */
function isValidImageUrl(url: string): boolean {
    if (!url) return false;

    // Skip data URLs that are too short (likely tracking pixels)
    if (url.startsWith('data:') && url.length < 100) return false;

    // Skip common tracking/ad images
    const blocklist = [
        'pixel', 'tracker', 'analytics', 'beacon',
        '1x1', 'spacer', 'blank', 'transparent',
        'logo', 'icon', 'avatar', 'badge',
    ];

    const lowerUrl = url.toLowerCase();
    if (blocklist.some(term => lowerUrl.includes(term))) {
        return false;
    }

    return true;
}

/**
 * Check if image is likely too small (icons, badges)
 */
function isSmallImage(url: string): boolean {
    const lowerUrl = url.toLowerCase();

    // Check for size indicators in URL
    const smallPatterns = [
        /\d{1,2}x\d{1,2}/, // 1x1, 16x16, etc.
        /icon/,
        /favicon/,
        /badge/,
        /emoji/,
        /avatar/,
    ];

    return smallPatterns.some(pattern => pattern.test(lowerUrl));
}

/**
 * Normalize image URL (handle protocol-relative, etc.)
 */
function normalizeImageUrl(url: string): string {
    if (url.startsWith('//')) {
        return 'https:' + url;
    }
    return url;
}

/**
 * Clean and normalize article title
 */
export function cleanTitle(title: string): string {
    if (!title) return '';

    return title
        // Remove site name suffixes (e.g., "Title | Site Name")
        .replace(/\s*[\|\-–—]\s*[^|\-–—]+$/, '')
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extract tags from content
 */
export function extractTags(text: string, existingTags: string[] = []): string[] {
    const techKeywords = [
        'javascript', 'typescript', 'react', 'vue', 'angular', 'node', 'nodejs',
        'python', 'java', 'golang', 'go', 'rust', 'kotlin', 'swift',
        'docker', 'kubernetes', 'k8s', 'aws', 'gcp', 'azure', 'cloud',
        'api', 'graphql', 'rest', 'microservices', 'serverless',
        'database', 'mongodb', 'postgresql', 'mysql', 'redis',
        'machine learning', 'ml', 'ai', 'artificial intelligence',
        'devops', 'ci/cd', 'git', 'github',
        'css', 'html', 'web', 'frontend', 'backend',
        'mobile', 'ios', 'android', 'flutter', 'react native',
        'security', 'testing', 'performance', 'optimization',
    ];

    const lowerText = text.toLowerCase();
    const foundTags: Set<string> = new Set(existingTags.map(t => t.toLowerCase()));

    for (const keyword of techKeywords) {
        if (lowerText.includes(keyword)) {
            foundTags.add(keyword);
        }
    }

    return Array.from(foundTags).slice(0, 10); // Max 10 tags
}

/**
 * Estimate skill level from content
 */
export function estimateSkillLevel(text: string, title: string): 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' {
    const combined = (title + ' ' + text).toLowerCase();

    const beginnerTerms = [
        'beginner', 'introduction', 'getting started', 'tutorial',
        'basics', 'fundamental', 'learn', 'first steps', 'simple',
        'easy', 'starter', 'newbie', '101', 'for beginners',
    ];

    const advancedTerms = [
        'advanced', 'deep dive', 'internals', 'architecture',
        'optimization', 'performance', 'scalability', 'enterprise',
        'production', 'expert', 'master', 'pro tips', 'best practices',
        'patterns', 'anti-patterns', 'trade-offs',
    ];

    const beginnerScore = beginnerTerms.filter(t => combined.includes(t)).length;
    const advancedScore = advancedTerms.filter(t => combined.includes(t)).length;

    if (advancedScore >= 2) return 'ADVANCED';
    if (beginnerScore >= 2) return 'BEGINNER';

    return 'INTERMEDIATE';
}
