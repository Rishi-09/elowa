import { Types } from 'mongoose';
import {
  Conversation,
  MAX_GROUP_MEMBERS,
  isAdmin,
  type ConversationDoc,
  type ConversationDocument,
} from '../../models/Conversation';
import { Message } from '../../models/Message';
import { User, publicUser, type UserDoc } from '../../models/User';
import { Errors } from '../../lib/errors';

export type SerializedConversation = Awaited<ReturnType<typeof serialize>>;

const unreadFor = (conv: ConversationDoc, me: Types.ObjectId): number =>
  (conv.unread as unknown as Map<string, number>)?.get(String(me)) ?? 0;

/**
 * Wire shape for one conversation.
 *
 * Direct conversations expose `peer` (presence-filtered by that user's privacy
 * choices). Groups expose `title`, `members` and `adminIds` instead, and set
 * `peer` to a synthetic entry so existing list rendering keeps working.
 */
export async function serialize(convId: Types.ObjectId, me: Types.ObjectId) {
  const conv = await Conversation.findById(convId);
  if (!conv) throw Errors.notFound('Conversation not found');

  const lastMessage = conv.lastMessageId
    ? await Message.findById(conv.lastMessageId)
        .select({ type: 1, body: 1, createdAt: 1, senderId: 1, deletedAt: 1 })
        .lean()
    : null;

  const base = {
    id: String(conv._id),
    type: conv.type,
    participantIds: conv.participantIds.map(String),
    lastMessage: lastMessage
      ? {
          id: String(lastMessage._id),
          type: lastMessage.type,
          body: lastMessage.deletedAt ? null : lastMessage.body,
          senderId: String(lastMessage.senderId),
          createdAt: (lastMessage as unknown as { createdAt: Date }).createdAt,
        }
      : null,
    lastMessageAt: conv.lastMessageAt,
    unreadCount: unreadFor(conv, me),
    disappearingTtlSeconds: conv.disappearingTtlSeconds,
  };

  if (conv.type === 'group') {
    const members = await User.find({ _id: { $in: conv.participantIds } });
    return {
      ...base,
      title: conv.title ?? 'Group',
      avatarUrl: conv.avatarUrl,
      adminIds: conv.adminIds.map(String),
      members: members.map(publicUser),
      /* Keeps one rendering path for both conversation kinds. */
      peer: {
        id: String(conv._id),
        username: '',
        displayName: conv.title ?? 'Group',
        avatarUrl: conv.avatarUrl,
        bio: null,
        isOnline: false,
        lastSeenAt: null,
      },
    };
  }

  const peerId = conv.participantIds.find((p) => !p.equals(me));
  const peer = peerId ? await User.findById(peerId) : null;
  return {
    ...base,
    title: null,
    avatarUrl: null,
    adminIds: [] as string[],
    members: peer ? [publicUser(peer)] : [],
    peer: peer ? publicUser(peer) : null,
  };
}

async function loadMember(convId: string, me: Types.ObjectId): Promise<ConversationDocument> {
  if (!Types.ObjectId.isValid(convId)) throw Errors.notFound('Conversation not found');
  const conv = await Conversation.findOne({ _id: convId, participantIds: me });
  if (!conv) throw Errors.notFound('Conversation not found');
  return conv;
}

function assertGroupAdmin(conv: ConversationDocument, me: Types.ObjectId): void {
  if (conv.type !== 'group') throw Errors.badRequest('not_group', 'Not a group conversation');
  if (!isAdmin(conv, me)) throw Errors.forbidden('Only group admins can do that');
}

export const conversationsService = {
  async list(me: Types.ObjectId, limit = 50) {
    const convs = await Conversation.find({ participantIds: me })
      .sort({ lastMessageAt: -1, _id: -1 })
      .limit(limit);
    return Promise.all(convs.map((c) => serialize(c._id, me)));
  },

  async get(me: Types.ObjectId, conversationId: string) {
    const conv = await loadMember(conversationId, me);
    return serialize(conv._id, me);
  },

  /** Create (or return) the single direct conversation between two users. */
  async createDirect(me: Types.ObjectId, peerUserId: string) {
    const peerId = new Types.ObjectId(peerUserId);
    if (peerId.equals(me)) throw Errors.badRequest('invalid_peer', 'Cannot message yourself');

    const peer = await User.findById(peerId);
    if (!peer) throw Errors.notFound('User not found');

    const participants = [me, peerId].sort((a, b) => a.toString().localeCompare(b.toString()));
    const existing = await Conversation.findOne({
      type: 'direct',
      participantIds: { $all: participants, $size: 2 },
    });
    const conv =
      existing ??
      (await Conversation.create({
        type: 'direct',
        participantIds: participants,
        createdBy: me,
      }));

    return { conversation: await serialize(conv._id, me), created: !existing };
  },

  /** Create a group. The creator is its first administrator. */
  async createGroup(me: Types.ObjectId, title: string, memberIds: string[]) {
    const unique = Array.from(new Set(memberIds.filter((id) => Types.ObjectId.isValid(id))))
      .map((id) => new Types.ObjectId(id))
      .filter((id) => !id.equals(me));

    if (unique.length < 1) {
      throw Errors.badRequest('too_few_members', 'Add at least one other member');
    }
    if (unique.length + 1 > MAX_GROUP_MEMBERS) {
      throw Errors.badRequest('too_many_members', `Groups hold up to ${MAX_GROUP_MEMBERS} members`);
    }

    const found = await User.countDocuments({ _id: { $in: unique } });
    if (found !== unique.length) throw Errors.badRequest('unknown_member', 'Unknown member');

    const conv = await Conversation.create({
      type: 'group',
      title: title.trim(),
      participantIds: [me, ...unique],
      adminIds: [me],
      createdBy: me,
    });
    return serialize(conv._id, me);
  },

  /** Disappearing-message TTL. Any member may change it. */
  async setDisappearing(me: Types.ObjectId, conversationId: string, seconds: number | null) {
    const conv = await loadMember(conversationId, me);
    conv.disappearingTtlSeconds = seconds;
    await conv.save();
    return serialize(conv._id, me);
  },

  /** Group title and avatar. Admins only. */
  async updateGroup(
    me: Types.ObjectId,
    conversationId: string,
    patch: { title?: string; avatarUrl?: string | null },
  ) {
    const conv = await loadMember(conversationId, me);
    assertGroupAdmin(conv, me);
    if (patch.title !== undefined) conv.title = patch.title.trim();
    if (patch.avatarUrl !== undefined) conv.avatarUrl = patch.avatarUrl;
    await conv.save();
    return serialize(conv._id, me);
  },

  async addMembers(me: Types.ObjectId, conversationId: string, userIds: string[]) {
    const conv = await loadMember(conversationId, me);
    assertGroupAdmin(conv, me);

    const toAdd = Array.from(new Set(userIds.filter((id) => Types.ObjectId.isValid(id))))
      .map((id) => new Types.ObjectId(id))
      .filter((id) => !conv.participantIds.some((p) => p.equals(id)));

    if (!toAdd.length) return serialize(conv._id, me);
    if (conv.participantIds.length + toAdd.length > MAX_GROUP_MEMBERS) {
      throw Errors.badRequest('too_many_members', `Groups hold up to ${MAX_GROUP_MEMBERS} members`);
    }

    const found = await User.countDocuments({ _id: { $in: toAdd } });
    if (found !== toAdd.length) throw Errors.badRequest('unknown_member', 'Unknown member');

    conv.participantIds.push(...toAdd);
    await conv.save();
    return serialize(conv._id, me);
  },

  async removeMember(me: Types.ObjectId, conversationId: string, userId: string) {
    const conv = await loadMember(conversationId, me);
    assertGroupAdmin(conv, me);
    if (!Types.ObjectId.isValid(userId)) throw Errors.notFound('Member not found');

    const target = new Types.ObjectId(userId);
    if (target.equals(me)) throw Errors.badRequest('use_leave', 'Use leave to remove yourself');
    if (!conv.participantIds.some((p) => p.equals(target))) {
      throw Errors.notFound('Member not found');
    }
    if (conv.participantIds.length - 1 < 2) {
      throw Errors.badRequest('too_few_members', 'A group keeps at least two members');
    }

    conv.set(
      'participantIds',
      conv.participantIds.filter((p) => !p.equals(target)),
    );
    conv.set(
      'adminIds',
      conv.adminIds.filter((a) => !a.equals(target)),
    );
    (conv.unread as unknown as Map<string, number>)?.delete(String(target));
    await conv.save();
    return serialize(conv._id, me);
  },

  async setAdmin(me: Types.ObjectId, conversationId: string, userId: string, admin: boolean) {
    const conv = await loadMember(conversationId, me);
    assertGroupAdmin(conv, me);
    if (!Types.ObjectId.isValid(userId)) throw Errors.notFound('Member not found');

    const target = new Types.ObjectId(userId);
    if (!conv.participantIds.some((p) => p.equals(target))) {
      throw Errors.notFound('Member not found');
    }

    const already = conv.adminIds.some((a) => a.equals(target));
    if (admin && !already) conv.adminIds.push(target);
    if (!admin) {
      if (conv.adminIds.length <= 1 && already) {
        throw Errors.badRequest('last_admin', 'A group keeps at least one admin');
      }
      conv.set(
        'adminIds',
        conv.adminIds.filter((a) => !a.equals(target)),
      );
    }
    await conv.save();
    return serialize(conv._id, me);
  },

  /**
   * Leave a group. The last admin hands the role to the longest-standing
   * remaining member so a group can never end up with no admin.
   */
  async leaveGroup(me: Types.ObjectId, conversationId: string) {
    const conv = await loadMember(conversationId, me);
    if (conv.type !== 'group') throw Errors.badRequest('not_group', 'Not a group conversation');

    const remaining = conv.participantIds.filter((p) => !p.equals(me));
    if (remaining.length < 2) {
      throw Errors.badRequest('too_few_members', 'A group keeps at least two members');
    }

    const admins = conv.adminIds.filter((a) => !a.equals(me));
    conv.set('participantIds', remaining);
    conv.set('adminIds', admins.length ? admins : [remaining[0]!]);
    (conv.unread as unknown as Map<string, number>)?.delete(String(me));
    await conv.save();
    return { left: true };
  },
};

export type { UserDoc };
