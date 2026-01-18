
import { Schema, model, Document } from 'mongoose';

export interface ILearningGap extends Document {
    userId: string;
    topic: string;
    articleCount: number;
    percentile: number; // 0-100 (Compared to peers)
    isWeak: boolean;
    isStrong: boolean;
    averageForRole: number;
    lastUpdated: Date;
    createdAt: Date;
}

const learningGapSchema = new Schema<ILearningGap>(
    {
        userId: { type: String, required: true, index: true },
        topic: { type: String, required: true },
        articleCount: { type: Number, default: 0 },
        percentile: { type: Number, default: 0 },
        isWeak: { type: Boolean, default: false },
        isStrong: { type: Boolean, default: false },
        averageForRole: { type: Number, default: 0 },
        lastUpdated: { type: Date, default: Date.now },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

learningGapSchema.index({ userId: 1, topic: 1 }, { unique: true });
learningGapSchema.index({ userId: 1, isWeak: 1 }); // Find weak areas fast

export const LearningGap = model<ILearningGap>('LearningGap', learningGapSchema);
