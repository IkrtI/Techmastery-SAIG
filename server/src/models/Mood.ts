import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

export const MOOD_TYPES = ['happy', 'hyped', 'meh', 'tired', 'stressed', 'sad'] as const;
export type MoodType = (typeof MOOD_TYPES)[number];

const moodSchema = new Schema(
  {
    // Never serialized — anonymity invariant (SPECS §3/§5).
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    moodType: { type: String, enum: MOOD_TYPES, required: true },
    text: { type: String, required: true, minlength: 1, maxlength: 280 },
    faculty: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
    major: { type: String, required: true },
    majorNormalized: { type: String, required: true },
    year: { type: Number, required: true, min: 1, max: 8 },
  },
  { timestamps: true },
);

moodSchema.index({ createdAt: -1, _id: -1 });
moodSchema.index({ faculty: 1, createdAt: -1, _id: -1 });
moodSchema.index({ majorNormalized: 1, createdAt: -1, _id: -1 });
moodSchema.index({ moodType: 1, createdAt: -1, _id: -1 });
moodSchema.index({ author: 1, createdAt: -1, _id: -1 });

export type MoodDoc = InferSchemaType<typeof moodSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export const Mood = model('Mood', moodSchema);
