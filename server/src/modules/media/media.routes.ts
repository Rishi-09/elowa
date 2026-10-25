import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import express, { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { uploadLimiter } from '../../middleware/rateLimit';
import { ok } from '../../lib/response';
import { Errors } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';
import { Message } from '../../models/Message';
import { Conversation } from '../../models/Conversation';
import { allowedMimeFor, type MediaProvider } from './MediaProvider';
import { cloudinaryProvider } from './CloudinaryProvider';
import {
  localDiskProvider,
  readMeta,
  resolveObjectPath,
  verifyTicket,
  writeMeta,
} from './LocalDiskProvider';

export const mediaProvider: MediaProvider =
  env.MEDIA_PROVIDER === 'cloudinary' ? cloudinaryProvider : localDiskProvider;

const signBody = z.object({ kind: z.enum(['image', 'video']) });

const confirmBody = z.object({
  publicId: z.string().min(1).max(256),
  kind: z.enum(['image', 'video']),
  mime: z.string().min(1).max(100),
  size: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().nonnegative().optional(),
});

const sign: RequestHandler = async (req, res, next) => {
  try {
    ok(res, await mediaProvider.signUpload(req.userId!, req.body.kind));
  } catch (e) {
    next(e);
  }
};

const confirm: RequestHandler = async (req, res, next) => {
  try {
    ok(res, await mediaProvider.confirm(req.userId!, req.body));
  } catch (e) {
    next(e);
  }
};

/**
 * Raw upload for the local provider. Authorization comes from the signed
 * upload ticket (not the session), so the object key, byte cap and expiry are
 * all fixed by the server at sign time and cannot be renegotiated here.
 */
const upload: RequestHandler = async (req, res, next) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) throw Errors.unauthorized('Missing upload ticket');
    const ticket = verifyTicket(token);

    const mime = String(req.headers['content-type'] ?? '').split(';')[0]?.trim() ?? '';
    if (!allowedMimeFor(ticket.kind).has(mime)) {
      throw Errors.badRequest('bad_mime', `Unsupported ${ticket.kind} type: ${mime || 'unknown'}`);
    }

    const body = req.body as Buffer | undefined;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw Errors.badRequest('empty_body', 'No file bytes received');
    }
    if (body.length > ticket.max) {
      throw Errors.badRequest('too_large', 'File exceeds size limit');
    }

    const full = resolveObjectPath(ticket.pid);
    await fsp.mkdir(path.dirname(full), { recursive: true });
    await fsp.writeFile(full, body, { flag: 'w' });
    await writeMeta(full, { mime, size: body.length });

    ok(res, { publicId: ticket.pid, size: body.length }, 201);
  } catch (e) {
    next(e);
  }
};

/**
 * Serve a stored object. Private media is gated the same way messages are:
 * the caller must either own the object, or be a participant of a
 * conversation that carries a live message referencing it.
 */
const serve: RequestHandler = async (req, res, next) => {
  try {
    const publicId = String(req.params.publicId ?? '');
    const full = resolveObjectPath(publicId);

    const me = new Types.ObjectId(req.userId);
    const owner = publicId.startsWith(`u_${req.userId}/`);

    if (!owner) {
      const url = `${env.PUBLIC_BASE_URL}/api/media/file/${publicId}`;
      const msg = await Message.findOne({
        deletedAt: null,
        $or: [{ 'media.url': url }, { 'media.thumbUrl': url }],
      })
        .select({ conversationId: 1 })
        .lean();
      if (!msg) throw Errors.notFound('Media not found');

      const member = await Conversation.exists({ _id: msg.conversationId, participantIds: me });
      if (!member) throw Errors.forbidden('Not a member of this conversation');
    }

    const stat = await fsp.stat(full).catch(() => null);
    if (!stat?.isFile()) throw Errors.notFound('Media not found');

    const meta = await readMeta(full);
    res.setHeader('Content-Type', meta?.mime ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const stream = fs.createReadStream(full);
    stream.on('error', (err) => {
      logger.warn({ err }, 'media stream failed');
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });
    stream.pipe(res);
  } catch (e) {
    next(e);
  }
};

export const mediaRouter = Router();

/* The raw upload route authenticates with its own ticket and must read the
   body as bytes, so it is mounted before the session guard. */
mediaRouter.put(
  '/upload',
  uploadLimiter,
  express.raw({ type: () => true, limit: env.MEDIA_MAX_VIDEO_BYTES }),
  upload,
);

mediaRouter.use(requireAuth);
mediaRouter.post('/sign', validateBody(signBody), sign);
mediaRouter.post('/confirm', validateBody(confirmBody), confirm);
mediaRouter.get('/file/:publicId(*)', serve);
