import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
  Types,
} from 'mongoose';

export const MAX_GROUP_MEMBERS = 256;

const conversationSchema = new Schema(
  {
    /** `direct` is strictly two people; `group` is 2..MAX_GROUP_MEMBERS. */
    type: { type: String, enum: ['direct', 'group'], default: 'direct', required: true },
    participantIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      required: true,
    },
    /** Group identity. Null on direct conversations, which borrow the peer's. */
    title: { type: String, default: null, trim: true, maxlength: 64 },
    avatarUrl: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    /** Group administrators; always a subset of participantIds. */
    adminIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    lastMessageId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    lastMessageAt: { type: Date, default: null },
    disappearingTtlSeconds: { type: Number, default: null, min: 0 },
    unread: {
      type: Map,
      of: Number,
      default: () => new Map<string, number>(),
    },
  },
  { timestamps: true },
);

conversationSchema.path('participantIds').validate(function validateSize(
  this: { type?: string },
  value: Types.ObjectId[],
) {
  if (!Array.isArray(value)) return false;
  if (this.type === 'group') return value.length >= 2 && value.length <= MAX_GROUP_MEMBERS;
  return value.length === 2;
}, 'Invalid participant count for this conversation type');

conversationSchema.index({ participantIds: 1, lastMessageAt: -1 });

export type ConversationDoc = InferSchemaType<typeof conversationSchema> & {
  _id: Types.ObjectId;
};
export const Conversation: Model<ConversationDoc> = model<ConversationDoc>(
  'Conversation',
  conversationSchema,
);

/** A loaded conversation with Mongoose document methods available. */
export type ConversationDocument = HydratedDocument<ConversationDoc>;

export const isAdmin = (conv: ConversationDoc, userId: Types.ObjectId): boolean =>
  conv.type === 'group' && conv.adminIds.some((a) => a.equals(userId));

export const isMember = (conv: ConversationDoc, userId: Types.ObjectId): boolean =>
  conv.participantIds.some((p) => p.equals(userId));
