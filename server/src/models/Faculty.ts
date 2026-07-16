import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const facultySchema = new Schema({
  nameTh: { type: String, required: true },
  nameEn: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  // Official KMITL faculty code — digits 3-4 of a student ID ("01" = Engineering).
  code: { type: String, index: true },
  // Seed-managed canonical suggestions; onboarding never mutates this list.
  knownMajors: { type: [String], default: [] },
});

export type FacultyDoc = InferSchemaType<typeof facultySchema> & { _id: Types.ObjectId };
export const Faculty = model('Faculty', facultySchema);
