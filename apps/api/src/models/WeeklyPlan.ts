
import { Schema, model, Document } from 'mongoose';

export interface PlanArticle {
    articleId: string;
    day: string; // "Monday", etc
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    reason: string;
    completed: boolean;
    completedAt?: Date;
}

export interface IWeeklyPlan extends Document {
    userId: string;
    week: string; // "YYYY-MM-DD" (Start of week)
    theme: string;
    articles: PlanArticle[];
    completionRate: number; // 0-100
    isComplete: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const planArticleSchema = new Schema<PlanArticle>(
    {
        articleId: { type: String, required: true },
        day: { type: String, required: true },
        difficulty: { type: String, required: true },
        reason: { type: String },
        completed: { type: Boolean, default: false },
        completedAt: { type: Date },
    },
    { _id: false }
);

const weeklyPlanSchema = new Schema<IWeeklyPlan>(
    {
        userId: { type: String, required: true, index: true },
        week: { type: String, required: true },
        theme: { type: String },
        articles: { type: [planArticleSchema], default: [] },
        completionRate: { type: Number, default: 0 },
        isComplete: { type: Boolean, default: false },
    },
    { timestamps: true }
);

weeklyPlanSchema.index({ userId: 1, week: 1 }, { unique: true }); // One plan per week per user

export const WeeklyPlan = model<IWeeklyPlan>('WeeklyPlan', weeklyPlanSchema);
