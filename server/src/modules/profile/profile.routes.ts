import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { User, selfUser, privacyOf } from '../../models/User';
import { httpUrl } from '../../lib/validators';
import { ok } from '../../lib/response';
import { Errors } from '../../lib/errors';

/* Strict: an unknown key is a client bug, and silently ignoring it would
   look like a successful save that changed nothing. */
const patchBody = z
  .object({
    displayName: z.string().trim().min(1).max(48).optional(),
    bio: z.string().max(240).nullable().optional(),
    avatarUrl: httpUrl.nullable().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update');

const pushTokenBody = z.object({ token: z.string().min(1).max(256) });

const privacyBody = z
  .object({
    showPresence: z.boolean().optional(),
    showReadReceipts: z.boolean().optional(),
    searchable: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update');

const pushPrefsBody = z.object({
  enabled: z.boolean().optional(),
  showPreview: z.boolean().optional(),
});

const me: RequestHandler = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) throw Errors.notFound();
    ok(res, selfUser(user));
  } catch (e) {
    next(e);
  }
};

const patch: RequestHandler = async (req, res, next) => {
  try {
    /* Only the validated fields are written: the body cannot reach
       `passwordHash`, `username` or the privacy block through this route. */
    const update: Record<string, unknown> = {};
    if (req.body.displayName !== undefined) update.displayName = req.body.displayName;
    if (req.body.bio !== undefined) update.bio = req.body.bio;
    if (req.body.avatarUrl !== undefined) update.avatarUrl = req.body.avatarUrl;

    const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true });
    if (!user) throw Errors.notFound();
    ok(res, selfUser(user));
  } catch (e) {
    next(e);
  }
};

const getPrivacy: RequestHandler = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) throw Errors.notFound();
    ok(res, privacyOf(user));
  } catch (e) {
    next(e);
  }
};

const patchPrivacy: RequestHandler = async (req, res, next) => {
  try {
    const update: Record<string, boolean> = {};
    for (const key of ['showPresence', 'showReadReceipts', 'searchable'] as const) {
      if (typeof req.body[key] === 'boolean') update[`privacy.${key}`] = req.body[key];
    }
    const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true });
    if (!user) throw Errors.notFound();

    /* Going invisible should take effect immediately, not at next login. */
    if (update['privacy.showPresence'] === false) {
      await User.updateOne({ _id: user._id }, { $set: { isOnline: false } });
    }
    ok(res, privacyOf(user));
  } catch (e) {
    next(e);
  }
};

const registerPushToken: RequestHandler = async (req, res, next) => {
  try {
    await User.updateOne(
      { _id: new Types.ObjectId(req.userId) },
      { $set: { pushToken: req.body.token } },
    );
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
};

const removePushToken: RequestHandler = async (req, res, next) => {
  try {
    await User.updateOne(
      { _id: new Types.ObjectId(req.userId) },
      { $set: { pushToken: null } },
    );
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
};

const getPushPrefs: RequestHandler = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).lean();
    const prefs = user?.pushPrefs ?? { enabled: true, showPreview: true };
    ok(res, prefs);
  } catch (e) {
    next(e);
  }
};

const patchPushPrefs: RequestHandler = async (req, res, next) => {
  try {
    const update: Record<string, unknown> = {};
    if (typeof req.body.enabled === 'boolean') update['pushPrefs.enabled'] = req.body.enabled;
    if (typeof req.body.showPreview === 'boolean')
      update['pushPrefs.showPreview'] = req.body.showPreview;
    await User.updateOne({ _id: new Types.ObjectId(req.userId) }, { $set: update });
    const user = await User.findById(req.userId).lean();
    ok(res, user?.pushPrefs ?? { enabled: true, showPreview: true });
  } catch (e) {
    next(e);
  }
};

export const profileRouter = Router();
profileRouter.use(requireAuth);
profileRouter.get('/', me);
profileRouter.patch('/', validateBody(patchBody), patch);
profileRouter.get('/privacy', getPrivacy);
profileRouter.patch('/privacy', validateBody(privacyBody), patchPrivacy);

export const devicesRouter = Router();
devicesRouter.use(requireAuth);
devicesRouter.post('/push-token', validateBody(pushTokenBody), registerPushToken);
devicesRouter.delete('/push-token', removePushToken);
devicesRouter.get('/push-prefs', getPushPrefs);
devicesRouter.patch('/push-prefs', validateBody(pushPrefsBody), patchPushPrefs);
