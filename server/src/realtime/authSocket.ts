import jwt from 'jsonwebtoken';
import type { Socket } from 'socket.io';
import { env } from '../config/env';

type AccessClaims = { sub: string; sid: string };

export function authSocket(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  const token =
    (socket.handshake.auth?.token as string | undefined) ??
    (socket.handshake.headers.authorization?.toString().replace(/^Bearer /, '') ?? undefined);
  if (!token) return next(new Error('unauthorized'));
  try {
    const claims = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims;
    socket.data.userId = claims.sub;
    next();
  } catch {
    next(new Error('unauthorized'));
  }
}
