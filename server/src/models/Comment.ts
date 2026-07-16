import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const commentSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Mood', required: true },
    // Never serialized — anonymity invariant applies to comments too.
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, minlength: 1, maxlength: 200 },
    faculty: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
    year: { type: Number, required: true, min: 1, max: 8 },
  },
  { timestamps: true },
);

commentSchema.index({ post: 1, createdAt: 1, _id: 1 });
commentSchema.index({ author: 1 });

export type CommentDoc = InferSchemaType<typeof commentSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export const Comment = model('Comment', commentSchema);
