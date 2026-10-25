import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ['req.headers.authorization', '*.password', '*.passwordHash', '*.refreshToken'],
    remove: true,
  },
});
