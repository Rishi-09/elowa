import argon2 from 'argon2';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../../config/env';
import { User, publicUser, type UserDoc } from '../../models/User';
import { RefreshToken } from '../../models/RefreshToken';
import { Errors } from '../../lib/errors';

const hashToken = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

function signAccess(userId: string, sessionId: string): string {
  return jwt.sign({ sub: userId, sid: sessionId }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TTL_SECONDS,
  });
}

async function issueRefresh(userId: Types.ObjectId, replacesId?: Types.ObjectId) {
  const raw = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  const doc = await RefreshToken.create({ userId, tokenHash, expiresAt });
  if (replacesId) {
    await RefreshToken.updateOne(
      { _id: replacesId },
      { revokedAt: new Date(), replacedBy: doc._id },
    );
  }
  return { raw, id: doc._id };
}

async function makeSession(user: UserDoc, replacesId?: Types.ObjectId) {
  const refresh = await issueRefresh(user._id as unknown as Types.ObjectId, replacesId);
  const accessToken = signAccess(String(user._id), String(refresh.id));
  return {
    user: publicUser(user),
    accessToken,
    refreshToken: refresh.raw,
  };
}

export const authService = {
  async register(input: { username: string; displayName: string; password: string }) {
    const username = input.username.toLowerCase();
    const existing = await User.findOne({ username }).lean();
    if (existing) throw Errors.conflict('Username already taken');
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await User.create({
      username,
      displayName: input.displayName,
      passwordHash,
    });
    return makeSession(user);
  },

  async login(input: { username: string; password: string }) {
    const user = await User.findOne({ username: input.username.toLowerCase() }).select(
      '+passwordHash',
    );
    const invalid = Errors.badRequest('invalid_credentials', 'Invalid username or password');
    if (!user) {
      await argon2.hash(input.password).catch(() => {});
      throw invalid;
    }
    const ok = await argon2.verify(user.passwordHash, input.password).catch(() => false);
    if (!ok) throw invalid;
    return makeSession(user);
  },

  async refresh(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const token = await RefreshToken.findOne({ tokenHash });
    if (!token) throw Errors.unauthorized('Invalid refresh token');
    if (token.revokedAt) {
      await RefreshToken.updateMany({ userId: token.userId, revokedAt: null }, {
        revokedAt: new Date(),
      });
      throw Errors.unauthorized('Refresh token reused');
    }
    if (token.expiresAt.getTime() < Date.now()) throw Errors.unauthorized('Refresh token expired');
    const user = await User.findById(token.userId);
    if (!user) throw Errors.unauthorized('User not found');
    return makeSession(user, token._id);
  },

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    const tokenHash = hashToken(rawToken);
    await RefreshToken.updateOne({ tokenHash }, { revokedAt: new Date() });
  },
};
