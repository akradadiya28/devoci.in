/**
 * SavedArticle Model
 * User bookmarks/saves
 */

import { Schema, model, Document } from 'mongoose';

export interface ISavedArticle extends Document {
    userId: string;
    articleId: string;
    tags?: string[];  // User can add custom tags
    notes?: string;   // User notes
    savedAt: Date;
}

const savedArticleSchema = new Schema<ISavedArticle>(
    {
        userId: { type: String, required: true },
        articleId: { type: String, required: true },
        tags: { type: [String], default: [] },
        notes: { type: String },
        savedAt: { type: Date, default: Date.now },
    },
    { timestamps: false }
);

// Compound unique index - prevent duplicate saves
savedArticleSchema.index({ userId: 1, articleId: 1 }, { unique: true });
savedArticleSchema.index({ userId: 1, savedAt: -1 });  // User saved list

export const SavedArticle = model<ISavedArticle>('SavedArticle', savedArticleSchema);
