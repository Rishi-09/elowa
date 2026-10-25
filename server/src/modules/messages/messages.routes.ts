import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth } from '../../middleware/auth';
import { validateBody, validateQuery } from '../../middleware/validate';
import { messagesService } from './messages.service';
import { httpUrl } from '../../lib/validators';
import { ok } from '../../lib/response';

const sendBody = z.object({
  conversationId: z.string(),
  clientMessageId: z.string().min(8).max(64),
  type: z.enum(['text', 'image', 'video', 'gif', 'sticker']),
  body: z.string().max(8000).optional().nullable(),
  media: z
    .object({
      url: httpUrl,
      mime: z.string().max(100),
      width: z.number().optional(),
      height: z.number().optional(),
      duration: z.number().optional(),
      thumbUrl: httpUrl.optional(),
      size: z.number().optional(),
    })
    .optional()
    .nullable(),
  replyToId: z.string().optional().nullable(),
});

const editBody = z.object({ body: z.string().min(1).max(8000) });

/* Reactions are user content, so a short emoji string is accepted as-is —
   length-capped, and never interpreted as markup anywhere in the client. */
const reactBody = z.object({ emoji: z.string().min(1).max(16) });

const searchQuery = z.object({
  q: z.string().trim().min(2).max(64),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const listQuery = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const send: RequestHandler = async (req, res, next) => {
  try {
    const me = new Types.ObjectId(req.userId);
    const msg = await messagesService.send(me, req.body);
    ok(res, msg, 201);
  } catch (e) {
    next(e);
  }
};

/** Delete for me: drops the message from this caller's view only. */
const hide: RequestHandler = async (req, res, next) => {
  try {
    const me = new Types.ObjectId(req.userId);
    ok(res, await messagesService.hideForMe(me, req.params.id!));
  } catch (e) {
    next(e);
  }
};

const list: RequestHandler = async (req, res, next) => {
  try {
    const me = new Types.ObjectId(req.userId);
    const convId = req.params.conversationId!;
    const { before, limit } = (req as unknown as { validatedQuery: z.infer<typeof listQuery> })
      .validatedQuery;
    const result = await messagesService.list(me, convId, before, limit);
    ok(res, result);
  } catch (e) {
    next(e);
  }
};

const edit: RequestHandler = async (req, res, next) => {
  try {
    const me = new Types.ObjectId(req.userId);
    const msg = await messagesService.edit(me, req.params.id!, req.body.body);
    ok(res, msg);
  } catch (e) {
    next(e);
  }
};

const del: RequestHandler = async (req, res, next) => {
  try {
    const me = new Types.ObjectId(req.userId);
    const msg = await messagesService.softDelete(me, req.params.id!);
    ok(res, msg);
  } catch (e) {
    next(e);
  }
};

const react: RequestHandler = async (req, res, next) => {
  try {
    const me = new Types.ObjectId(req.userId);
    const msg = await messagesService.react(me, req.params.id!, req.body.emoji);
    ok(res, msg);
  } catch (e) {
    next(e);
  }
};

const search: RequestHandler = async (req, res, next) => {
  try {
    const me = new Types.ObjectId(req.userId);
    const { q, limit } = (req as unknown as { validatedQuery: z.infer<typeof searchQuery> })
      .validatedQuery;
    ok(res, await messagesService.search(me, req.params.conversationId!, q, limit));
  } catch (e) {
    next(e);
  }
};

export const messagesRouter = Router();
messagesRouter.use(requireAuth);
messagesRouter.post('/', validateBody(sendBody), send);
messagesRouter.patch('/:id', validateBody(editBody), edit);
messagesRouter.delete('/:id', del);
messagesRouter.post('/:id/hide', hide);
messagesRouter.post('/:id/reactions', validateBody(reactBody), react);

export const conversationMessagesRouter = Router({ mergeParams: true });
conversationMessagesRouter.use(requireAuth);
conversationMessagesRouter.get('/', validateQuery(listQuery), list);
conversationMessagesRouter.get('/search', validateQuery(searchQuery), search);
