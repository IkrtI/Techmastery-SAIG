import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const facultySchema = new Schema({
  nameTh: { type: String, required: true },
  nameEn: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  // Seed-managed canonical suggestions; onboarding never mutates this list.
  knownMajors: { type: [String], default: [] },
});

export type FacultyDoc = InferSchemaType<typeof facultySchema> & { _id: Types.ObjectId };
export const Faculty = model('Faculty', facultySchema);
