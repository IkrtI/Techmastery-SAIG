import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

export const REACTION_TYPES = ['encourage', 'relate', 'congrats', 'heart', 'hug', 'haha'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

const reactionSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Mood', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: REACTION_TYPES, required: true },
  },
  { timestamps: true },
);

// One reaction per user per post; changing type updates in place.
reactionSchema.index({ post: 1, user: 1 }, { unique: true });

export type ReactionDoc = InferSchemaType<typeof reactionSchema> & { _id: Types.ObjectId };
export const Reaction = model('Reaction', reactionSchema);
