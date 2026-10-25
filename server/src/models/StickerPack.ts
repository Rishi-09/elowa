import { Schema, model, type InferSchemaType, type Model, Types } from 'mongoose';

const stickerPackSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 48 },
    coverUrl: { type: String, required: true },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const stickerSchema = new Schema(
  {
    packId: { type: Schema.Types.ObjectId, ref: 'StickerPack', required: true, index: true },
    url: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    keywords: { type: [String], default: [] },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type StickerPackDoc = InferSchemaType<typeof stickerPackSchema> & { _id: Types.ObjectId };
export type StickerDoc = InferSchemaType<typeof stickerSchema> & { _id: Types.ObjectId };

export const StickerPack: Model<StickerPackDoc> = model<StickerPackDoc>(
  'StickerPack',
  stickerPackSchema,
);
export const Sticker: Model<StickerDoc> = model<StickerDoc>('Sticker', stickerSchema);

export const publicPack = (p: StickerPackDoc) => ({
  id: String(p._id),
  slug: p.slug,
  name: p.name,
  coverUrl: p.coverUrl,
  order: p.order,
});

export const publicSticker = (s: StickerDoc) => ({
  id: String(s._id),
  packId: String(s.packId),
  url: s.url,
  width: s.width,
  height: s.height,
});
