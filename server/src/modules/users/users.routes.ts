import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { User, publicUser, privacyOf, type UserDoc } from '../../models/User';
import { Conversation } from '../../models/Conversation';
import { requireAuth } from '../../middleware/auth';
import { validateQuery } from '../../middleware/validate';
import { Errors } from '../../lib/errors';
import { ok } from '../../lib/response';

/**
 * Discovery view: strips presence (isOnline / lastSeenAt) so that any
 * authenticated account cannot poll presence for arbitrary user IDs they
 * found by username enumeration. Presence is revealed only when a shared
 * conversation exists, or through the socket's conversation-scoped
 * presence:update events — i.e. after a real relationship forms.
 */
const discoveryUser = (u: UserDoc) => {
  const p = publicUser(u);
  return {
    id: p.id,
    username: p.username,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    bio: p.bio,
  };
};

/**
 * True when both users already belong to the same conversation - direct or
 * group. Sharing a conversation is what upgrades a stranger to someone whose
 * presence may be revealed.
 */
async function haveSharedConversation(a: Types.ObjectId, b: Types.ObjectId): Promise<boolean> {
  if (a.equals(b)) return true;
  const exists = await Conversation.exists({ participantIds: { $all: [a, b] } });
  return !!exists;
}

const searchQuery = z.object({
  q: z.string().trim().min(1).max(32),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

const search: RequestHandler = async (req, res, next) => {
  try {
    const { q, limit } = (req as unknown as { validatedQuery: z.infer<typeof searchQuery> })
      .validatedQuery;
    const safe = q.replace(/[^a-z0-9_]/gi, '');
    if (!safe) return ok(res, []);
    const re = new RegExp(`^${safe}`, 'i');
    /* Users who turned discovery off are not returned to anyone else. */
    const users = await User.find({
      $or: [{ username: re }, { displayName: re }],
      _id: { $ne: new Types.ObjectId(req.userId) },
      'privacy.searchable': { $ne: false },
    }).limit(limit);
    ok(res, users.map(discoveryUser));
  } catch (e) {
    next(e);
  }
};

const getById: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id || !Types.ObjectId.isValid(id)) throw Errors.notFound('User not found');
    const user = await User.findById(id);
    if (!user) throw Errors.notFound('User not found');

    const shared = await haveSharedConversation(
      new Types.ObjectId(req.userId),
      user._id as unknown as Types.ObjectId,
    );
    if (!shared && !privacyOf(user).searchable) throw Errors.notFound('User not found');
    ok(res, shared ? publicUser(user) : discoveryUser(user));
  } catch (e) {
    next(e);
  }
};

export const usersRouter = Router();
usersRouter.use(requireAuth);
usersRouter.get('/search', validateQuery(searchQuery), search);
usersRouter.get('/:id', getById);
