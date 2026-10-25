import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  MONGO_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TTL_SECONDS: z.coerce.number().default(600),
  REFRESH_TTL_DAYS: z.coerce.number().default(30),
  CORS_ORIGIN: z.string().default('*'),
  /* Rate limits are env-tunable so deployments behind a shared egress IP (or
     test runs that create many accounts) can raise them without code edits. */
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_AUTH_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_GENERAL_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_MEDIA_MAX: z.coerce.number().int().positive().default(600),
  RATE_LIMIT_UPLOAD_MAX: z.coerce.number().int().positive().default(60),
  LOG_LEVEL: z.string().default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),
  MEDIA_PROVIDER: z.enum(['local', 'cloudinary']).default('local'),
  MEDIA_LOCAL_DIR: z.string().default('./var/media'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  MEDIA_MAX_IMAGE_BYTES: z.coerce.number().default(10 * 1024 * 1024),
  MEDIA_MAX_VIDEO_BYTES: z.coerce.number().default(50 * 1024 * 1024),
  TENOR_API_KEY: z.string().optional(),
  TENOR_CLIENT_KEY: z.string().default('elowa'),
});

export const env = schema.parse(process.env);
export type Env = typeof env;
