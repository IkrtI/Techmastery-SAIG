import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDb(uri = env().MONGODB_URI): Promise<void> {
  await mongoose.connect(uri);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
