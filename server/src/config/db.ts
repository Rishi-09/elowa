import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../lib/logger';

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGO_URI);
  logger.info({ uri: env.MONGO_URI.replace(/:[^:@/]+@/, ':***@') }, 'mongo connected');
}
