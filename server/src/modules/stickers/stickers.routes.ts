import { Router, type RequestHandler } from 'express';
import { Types } from 'mongoose';
import { requireAuth } from '../../middleware/auth';
import { Sticker, StickerPack, publicPack, publicSticker } from '../../models/StickerPack';
import { ok } from '../../lib/response';
import { Errors } from '../../lib/errors';

const listPacks: RequestHandler = async (_req, res, next) => {
  try {
    const packs = await StickerPack.find({ published: true }).sort({ order: 1, _id: 1 });
    ok(res, packs.map(publicPack));
  } catch (e) {
    next(e);
  }
};

const listPackStickers: RequestHandler = async (req, res, next) => {
  try {
    const packId = req.params.packId;
    if (!packId || !Types.ObjectId.isValid(packId)) throw Errors.notFound('Pack not found');
    const items = await Sticker.find({ packId: new Types.ObjectId(packId) }).sort({ order: 1 });
    ok(res, items.map(publicSticker));
  } catch (e) {
    next(e);
  }
};

export const stickersRouter = Router();
stickersRouter.use(requireAuth);
stickersRouter.get('/packs', listPacks);
stickersRouter.get('/packs/:packId/stickers', listPackStickers);
