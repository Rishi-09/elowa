import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MINUTES * 60 * 1000,
  max: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'rate_limited', message: 'Too many attempts' } },
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.RATE_LIMIT_GENERAL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'rate_limited', message: 'Slow down' } },
  /* Media reads get their own, much higher budget: one chat screen can
     legitimately fetch dozens of images in a few seconds. */
  skip: (req) => req.path.startsWith('/api/media/file/'),
});

export const mediaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.RATE_LIMIT_MEDIA_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'rate_limited', message: 'Slow down' } },
});

/** Uploads are expensive; cap them well below the general request budget. */
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: env.RATE_LIMIT_UPLOAD_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'rate_limited', message: 'Too many uploads' } },
});
