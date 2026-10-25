import { Types } from 'mongoose';
import { Conversation, clearedAtFor } from '../../models/Conversation';
import { Message, publicMessage, type MessageDoc } from '../../models/Message';
import { Errors } from '../../lib/errors';
import { decodeCursor, encodeCursor } from '../../lib/pagination';

export type SendInput = {
  conversationId: string;
  clientMessageId: string;
  type: 'text' | 'image' | 'video' | 'gif' | 'sticker';
  body?: string | null;
  media?: {
    url: string;
    mime: string;
    width?: number;
    height?: number;
    duration?: number;
    thumbUrl?: string;
    size?: number;
  } | null;
  replyToId?: string | null;
};

async function assertMember(convId: Types.ObjectId, userId: Types.ObjectId) {
  const conv = await Conversation.findOne({ _id: convId, participantIds: userId });
  if (!conv) throw Errors.forbidden('Not a member of this conversation');
  return conv;
}

export const messagesService = {
  async send(userId: Types.ObjectId, input: SendInput) {
    if (!Types.ObjectId.isValid(input.conversationId)) throw Errors.notFound('Conversation not found');
    const convId = new Types.ObjectId(input.conversationId);
    const conv = await assertMember(convId, userId);

    if (input.type === 'text') {
      if (!input.body?.trim()) throw Errors.badRequest('empty_body', 'Message body required');
    } else if (!input.media?.url) {
      throw Errors.badRequest('missing_media', 'Media required for this message type');
    }

    const expiresAt =
      conv.disappearingTtlSeconds && conv.disappearingTtlSeconds > 0
        ? new Date(Date.now() + conv.disappearingTtlSeconds * 1000)
        : null;

    let msg: MessageDoc;
    try {
      msg = await Message.create({
        conversationId: convId,
        senderId: userId,
        clientMessageId: input.clientMessageId,
        type: input.type,
        body: input.type === 'text' ? input.body!.trim() : null,
        media: input.type === 'text' ? null : input.media,
        replyToId:
          input.replyToId && Types.ObjectId.isValid(input.replyToId)
            ? new Types.ObjectId(input.replyToId)
            : null,
        status: 'sent',
        expiresAt,
      });
    } catch (e: unknown) {
      if ((e as { code?: number }).code === 11000) {
        const existing = await Message.findOne({
          senderId: userId,
          clientMessageId: input.clientMessageId,
        });
        if (existing) return publicMessage(existing);
      }
      throw e;
    }

    /* Every recipient's unread counter moves, which is what makes group
       badges correct; the sender's own counter is untouched. */
    const inc: Record<string, number> = {};
    for (const participant of conv.participantIds) {
      if (participant.equals(userId)) continue;
      inc[`unread.${String(participant)}`] = 1;
    }
    await Conversation.updateOne(
      { _id: convId },
      {
        $set: { lastMessageId: msg._id, lastMessageAt: new Date() },
        ...(Object.keys(inc).length ? { $inc: inc } : {}),
      },
    );

    return publicMessage(msg);
  },

  async list(userId: Types.ObjectId, conversationId: string, before: string | undefined, limit: number) {
    if (!Types.ObjectId.isValid(conversationId)) throw Errors.notFound();
    const convId = new Types.ObjectId(conversationId);
    const conv = await assertMember(convId, userId);

    /* Everything this user removed from their own view: messages they hid one
       by one, and anything predating a clear or delete of the whole chat. */
    const q: Record<string, unknown> = {
      conversationId: convId,
      hiddenFor: { $ne: userId },
    };
    const cleared = clearedAtFor(conv, userId);
    if (cleared) q.createdAt = { $gt: cleared };
    if (before) {
      const cur = decodeCursor(before);
      if (cur) {
        /* $and, not $or at top level: the clear watermark above is a lower
           bound and the cursor an upper one, and both must hold. */
        q.$and = [
          {
            $or: [
              { createdAt: { $lt: cur.createdAt } },
              { createdAt: cur.createdAt, _id: { $lt: cur.id } },
            ],
          },
        ];
      }
    }

    const docs = await Message.find(q).sort({ createdAt: -1, _id: -1 }).limit(limit);
    const nextCursor =
      docs.length === limit && docs[docs.length - 1]
        ? encodeCursor({
            createdAt: (docs[docs.length - 1] as unknown as { createdAt: Date }).createdAt,
            id: docs[docs.length - 1]!._id,
          })
        : null;
    return { items: docs.map(publicMessage), nextCursor };
  },

  async edit(userId: Types.ObjectId, id: string, body: string) {
    if (!Types.ObjectId.isValid(id)) throw Errors.notFound();
    const msg = await Message.findById(id);
    if (!msg || msg.deletedAt) throw Errors.notFound('Message not found');
    if (!msg.senderId.equals(userId)) throw Errors.forbidden();
    if (msg.type !== 'text') throw Errors.badRequest('non_text', 'Only text messages can be edited');
    msg.body = body.trim();
    msg.editedAt = new Date();
    await msg.save();
    return publicMessage(msg);
  },

  async softDelete(userId: Types.ObjectId, id: string) {
    if (!Types.ObjectId.isValid(id)) throw Errors.notFound();
    const msg = await Message.findById(id);
    if (!msg) throw Errors.notFound('Message not found');
    if (!msg.senderId.equals(userId)) throw Errors.forbidden();
    msg.deletedAt = new Date();
    msg.body = null;
    msg.media = null;
    await msg.save();
    return publicMessage(msg);
  },

  /**
   * Remove a message from one user's view only. Unlike softDelete this leaves
   * the message intact for everyone else, so it is allowed on messages the
   * caller did not send.
   */
  async hideForMe(userId: Types.ObjectId, id: string) {
    if (!Types.ObjectId.isValid(id)) throw Errors.notFound();
    const msg = await Message.findById(id);
    if (!msg) throw Errors.notFound('Message not found');
    await assertMember(msg.conversationId, userId);
    await Message.updateOne({ _id: msg._id }, { $addToSet: { hiddenFor: userId } });
    return { hidden: true };
  },

  async markDelivered(messageId: string, deliveredAt: Date) {
    if (!Types.ObjectId.isValid(messageId)) return;
    await Message.updateOne(
      { _id: new Types.ObjectId(messageId), status: 'sent' },
      { $set: { status: 'delivered', deliveredAt } },
    );
  },

  /**
   * Mark every message the recipient has not yet received as delivered. Run
   * when a participant joins a conversation room, so messages that arrived
   * while they were offline do not stay stuck on "sent" forever.
   *
   * Returns the ids that actually transitioned, so the caller only emits
   * receipts for real changes (idempotent across reconnects).
   */
  async markDeliveredFor(
    conversationId: string,
    recipientId: Types.ObjectId,
    deliveredAt = new Date(),
  ): Promise<string[]> {
    if (!Types.ObjectId.isValid(conversationId)) return [];
    const convId = new Types.ObjectId(conversationId);
    const filter = {
      conversationId: convId,
      senderId: { $ne: recipientId },
      status: 'sent' as const,
    };
    const pending = await Message.find(filter).select({ _id: 1 }).limit(500).lean();
    if (!pending.length) return [];
    const ids = pending.map((m) => m._id);
    await Message.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'delivered', deliveredAt } },
    );
    return ids.map(String);
  },

  /**
   * Mark everything up to `uptoMessageId` as read for this reader and clear
   * their unread counter. Returns the affected ids plus the read watermark so
   * the caller can tell senders exactly which bubbles changed — a single id
   * is not enough, because a reader catches up on many messages at once.
   */
  async markRead(
    userId: Types.ObjectId,
    conversationId: string,
    uptoMessageId: string,
  ): Promise<{ ids: string[]; uptoCreatedAt: string | null }> {
    const empty = { ids: [], uptoCreatedAt: null };
    if (!Types.ObjectId.isValid(conversationId) || !Types.ObjectId.isValid(uptoMessageId)) {
      return empty;
    }
    const convId = new Types.ObjectId(conversationId);
    await assertMember(convId, userId);

    const upto = await Message.findOne({ _id: uptoMessageId, conversationId: convId })
      .select({ createdAt: 1 })
      .lean();
    if (!upto) return empty;
    const watermark = (upto as unknown as { createdAt: Date }).createdAt;

    const filter = {
      conversationId: convId,
      senderId: { $ne: userId },
      createdAt: { $lte: watermark },
      status: { $ne: 'read' as const },
    };
    const pending = await Message.find(filter).select({ _id: 1 }).limit(500).lean();
    const ids = pending.map((m) => m._id);

    if (ids.length) {
      await Message.updateMany({ _id: { $in: ids } }, { $set: { status: 'read', readAt: new Date() } });
    }
    await Conversation.updateOne({ _id: convId }, { $set: { [`unread.${String(userId)}`]: 0 } });

    return { ids: ids.map(String), uptoCreatedAt: watermark.toISOString() };
  },

  /**
   * Toggle the caller's emoji reaction on a message. A user holds at most one
   * reaction per message: reacting again with the same emoji removes it,
   * a different emoji replaces it.
   */
  async react(userId: Types.ObjectId, messageId: string, emoji: string) {
    if (!Types.ObjectId.isValid(messageId)) throw Errors.notFound('Message not found');
    const msg = await Message.findById(messageId);
    if (!msg || msg.deletedAt) throw Errors.notFound('Message not found');
    await assertMember(msg.conversationId as unknown as Types.ObjectId, userId);

    const current = (msg.reactions ?? []).map((r) => ({
      userId: r.userId,
      emoji: r.emoji,
      at: r.at,
    }));
    const mine = current.find((r) => String(r.userId) === String(userId));
    const next = current.filter((r) => String(r.userId) !== String(userId));
    if (!mine || mine.emoji !== emoji) {
      next.push({ userId, emoji, at: new Date() });
    }
    msg.set('reactions', next);
    await msg.save();
    return publicMessage(msg);
  },

  /** Full-text search inside one conversation the caller belongs to. */
  async search(userId: Types.ObjectId, conversationId: string, query: string, limit: number) {
    if (!Types.ObjectId.isValid(conversationId)) throw Errors.notFound();
    const convId = new Types.ObjectId(conversationId);
    const conv = await assertMember(convId, userId);

    const cleared = clearedAtFor(conv, userId);
    const docs = await Message.find({
      conversationId: convId,
      deletedAt: null,
      type: 'text',
      hiddenFor: { $ne: userId },
      ...(cleared ? { createdAt: { $gt: cleared } } : {}),
      $text: { $search: query },
    })
      .sort({ createdAt: -1 })
      .limit(limit);
    return docs.map(publicMessage);
  },
};
