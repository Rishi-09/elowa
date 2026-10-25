import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Errors } from '../lib/errors';

type AccessClaims = { sub: string; sid: string };

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next(Errors.unauthorized());
  const token = header.slice(7);
  try {
    const claims = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims;
    req.userId = claims.sub;
    req.sessionId = claims.sid;
    next();
  } catch {
    next(Errors.unauthorized('Invalid or expired token'));
  }
};
