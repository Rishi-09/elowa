import { Schema, model, type InferSchemaType, type Model, Types } from 'mongoose';

const mediaSchema = new Schema(
  {
    url: { type: String, required: true },
    mime: { type: String, required: true },
    width: Number,
    height: Number,
    duration: Number,
    thumbUrl: String,
    size: Number,
  },
  { _id: false },
);

/**
 * Emoji reactions are genuine user content (not interface iconography), so an
 * emoji string is the right storage here. One reaction per user per message.
 */
const reactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true, maxlength: 16 },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clientMessageId: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'gif', 'sticker'],
      required: true,
    },
    body: { type: String, default: null, maxlength: 8000 },
    media: { type: mediaSchema, default: null },
    /**
     * Users who deleted this message only for themselves. Filtered out of
     * their reads while every other participant still sees it, which is what
     * separates "delete for me" from the `deletedAt` tombstone.
     */
    hiddenFor: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    replyToId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    reactions: { type: [reactionSchema], default: [] },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 });
messageSchema.index({ senderId: 1, clientMessageId: 1 }, { unique: true });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
/* Drives the per-conversation text search. */
messageSchema.index({ conversationId: 1, body: 'text' });

export type MessageDoc = InferSchemaType<typeof messageSchema> & { _id: Types.ObjectId };
export const Message: Model<MessageDoc> = model<MessageDoc>('Message', messageSchema);

export const publicMessage = (m: MessageDoc) => ({
  id: String(m._id),
  conversationId: String(m.conversationId),
  senderId: String(m.senderId),
  clientMessageId: m.clientMessageId,
  type: m.type,
  body: m.deletedAt ? null : m.body,
  media: m.deletedAt ? null : m.media,
  replyToId: m.replyToId ? String(m.replyToId) : null,
  reactions: (m.reactions ?? []).map((r) => ({
    userId: String(r.userId),
    emoji: r.emoji,
    at: r.at,
  })),
  status: m.status,
  editedAt: m.editedAt,
  deletedAt: m.deletedAt,
  expiresAt: m.expiresAt,
  createdAt: (m as unknown as { createdAt: Date }).createdAt,
});
