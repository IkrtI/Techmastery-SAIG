import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: /^[^@]+@kmitl\.ac\.th$/,
    },
    studentId: { type: String, required: true },
    displayName: { type: String, required: true },
    faculty: { type: Schema.Types.ObjectId, ref: 'Faculty' },
    major: { type: String, minlength: 1, maxlength: 100 },
    majorNormalized: { type: String },
    year: { type: Number, min: 1, max: 8, validate: Number.isInteger },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    onboarded: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export const User = model('User', userSchema);
