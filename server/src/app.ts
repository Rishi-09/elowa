import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { errorHandler, notFound } from './middleware/error';
import { generalLimiter, mediaLimiter } from './middleware/rateLimit';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { conversationsRouter } from './modules/conversations/conversations.routes';
import {
  messagesRouter,
  conversationMessagesRouter,
} from './modules/messages/messages.routes';
import { profileRouter, devicesRouter } from './modules/profile/profile.routes';
import { mediaRouter } from './modules/media/media.routes';
import { gifsRouter } from './modules/gifs/gifs.routes';
import { stickersRouter } from './modules/stickers/stickers.routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));
  app.use(generalLimiter);

  app.get('/api/health', (_req, res) => res.json({ ok: true, data: { status: 'ok' } }));

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api/conversations/:conversationId/messages', conversationMessagesRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/devices', devicesRouter);
  app.use('/api/media', mediaLimiter, mediaRouter);
  app.use('/api/gifs', gifsRouter);
  app.use('/api/stickers', stickersRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
