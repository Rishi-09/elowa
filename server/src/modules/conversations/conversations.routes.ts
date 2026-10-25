import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { ok } from '../../lib/response';
import { conversationsService } from './conversations.service';
import { httpUrl } from '../../lib/validators';

const objectId = z.string().refine(Types.ObjectId.isValid, 'Invalid id');

const createBody = z.object({ peerUserId: objectId });

const createGroupBody = z.object({
  title: z.string().trim().min(1).max(64),
  memberIds: z.array(objectId).min(1).max(255),
});

const patchBody = z
  .object({
    disappearingTtlSeconds: z
      .number()
      .int()
      .min(0)
      .max(60 * 60 * 24 * 30)
      .nullable()
      .optional(),
    title: z.string().trim().min(1).max(64).optional(),
    avatarUrl: httpUrl.nullable().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update');

const membersBody = z.object({ userIds: z.array(objectId).min(1).max(64) });
const adminBody = z.object({ admin: z.boolean() });

const me = (req: Parameters<RequestHandler>[0]) => new Types.ObjectId(req.userId);

const list: RequestHandler = async (req, res, next) => {
  try {
    ok(res, await conversationsService.list(me(req)));
  } catch (e) {
    next(e);
  }
};

const get: RequestHandler = async (req, res, next) => {
  try {
    ok(res, await conversationsService.get(me(req), req.params.id!));
  } catch (e) {
    next(e);
  }
};

const create: RequestHandler = async (req, res, next) => {
  try {
    const { conversation, created } = await conversationsService.createDirect(
      me(req),
      req.body.peerUserId,
    );
    ok(res, conversation, created ? 201 : 200);
  } catch (e) {
    next(e);
  }
};

const createGroup: RequestHandler = async (req, res, next) => {
  try {
    const conv = await conversationsService.createGroup(
      me(req),
      req.body.title,
      req.body.memberIds,
    );
    ok(res, conv, 201);
  } catch (e) {
    next(e);
  }
};

/** TTL is open to any member; title and avatar are admin-only. */
const patch: RequestHandler = async (req, res, next) => {
  try {
    const caller = me(req);
    const id = req.params.id!;
    let conv;

    if (req.body.disappearingTtlSeconds !== undefined) {
      conv = await conversationsService.setDisappearing(
        caller,
        id,
        req.body.disappearingTtlSeconds,
      );
    }
    if (req.body.title !== undefined || req.body.avatarUrl !== undefined) {
      conv = await conversationsService.updateGroup(caller, id, {
        title: req.body.title,
        avatarUrl: req.body.avatarUrl,
      });
    }
    ok(res, conv ?? (await conversationsService.get(caller, id)));
  } catch (e) {
    next(e);
  }
};

const addMembers: RequestHandler = async (req, res, next) => {
  try {
    ok(res, await conversationsService.addMembers(me(req), req.params.id!, req.body.userIds));
  } catch (e) {
    next(e);
  }
};

const clearForMe: RequestHandler = async (req, res, next) => {
  try {
    ok(res, await conversationsService.clearForMe(me(req), req.params.id!));
  } catch (e) {
    next(e);
  }
};

const deleteForMe: RequestHandler = async (req, res, next) => {
  try {
    ok(res, await conversationsService.deleteForMe(me(req), req.params.id!));
  } catch (e) {
    next(e);
  }
};

const removeMember: RequestHandler = async (req, res, next) => {
  try {
    ok(res, await conversationsService.removeMember(me(req), req.params.id!, req.params.userId!));
  } catch (e) {
    next(e);
  }
};

const setAdmin: RequestHandler = async (req, res, next) => {
  try {
    ok(
      res,
      await conversationsService.setAdmin(
        me(req),
        req.params.id!,
        req.params.userId!,
        req.body.admin,
      ),
    );
  } catch (e) {
    next(e);
  }
};

const leave: RequestHandler = async (req, res, next) => {
  try {
    ok(res, await conversationsService.leaveGroup(me(req), req.params.id!));
  } catch (e) {
    next(e);
  }
};

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth);
conversationsRouter.get('/', list);
conversationsRouter.post('/', validateBody(createBody), create);
conversationsRouter.post('/group', validateBody(createGroupBody), createGroup);
conversationsRouter.get('/:id', get);
conversationsRouter.patch('/:id', validateBody(patchBody), patch);
conversationsRouter.delete('/:id', deleteForMe);
conversationsRouter.post('/:id/clear', clearForMe);
conversationsRouter.post('/:id/members', validateBody(membersBody), addMembers);
conversationsRouter.delete('/:id/members/:userId', removeMember);
conversationsRouter.patch('/:id/members/:userId/admin', validateBody(adminBody), setAdmin);
conversationsRouter.post('/:id/leave', leave);
