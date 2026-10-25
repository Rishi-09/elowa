import { create } from 'zustand';
import type { Message, MessageReaction, MessageType, MediaRef } from '@/types';
import { socketClient } from '@/services/socket';
import type { AckWith, SendPayload } from '@/services/socketEvents';
import { clientMessageId } from '@/lib/ids';
import { localCache } from '@/services/localCache';
import { mediaService, type PickedAsset } from '@/features/media/mediaService';
import { messagesApi } from '@/features/messages/messagesApi';

type ConvState = {
  messages: Message[];
  typingUserIds: Set<string>;
};

type SendArgs = {
  conversationId: string;
  senderId: string;
  body: string;
  replyToId?: string | null;
};

type SendMediaFileArgs = {
  conversationId: string;
  senderId: string;
  asset: PickedAsset;
  replyToId?: string | null;
};

type SendMediaArgs = {
  conversationId: string;
  senderId: string;
  type: Exclude<MessageType, 'text'>;
  media: MediaRef;
  replyToId?: string | null;
};

type MessageState = {
  byConv: Record<string, ConvState>;
  ensure: (conversationId: string) => void;
  prepend: (conversationId: string, msgs: Message[]) => void;
  upsert: (conversationId: string, msg: Message) => void;
  markDeleted: (conversationId: string, id: string) => void;
  markEdited: (conversationId: string, id: string, body: string | null, editedAt: string) => void;
  markStatus: (conversationId: string, ids: string[], status: Message['status']) => void;
  setReactions: (conversationId: string, id: string, reactions: MessageReaction[]) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;

  send: (args: SendArgs) => Promise<void>;
  sendMedia: (args: SendMediaArgs) => Promise<void>;
  /** Pick-to-send: shows the local preview, uploads, then delivers. */
  sendMediaFile: (args: SendMediaFileArgs) => Promise<void>;
  retry: (conversationId: string, clientMessageId: string) => Promise<void>;
  edit: (conversationId: string, messageId: string, body: string) => Promise<void>;
  remove: (conversationId: string, messageId: string) => Promise<void>;
  /** Delete for me — drops the message locally and on the server, for us only. */
  hide: (conversationId: string, messageId: string) => Promise<void>;
  /** Forgets every message held for a conversation, in memory and on disk. */
  clearConversation: (conversationId: string) => Promise<void>;
  react: (conversationId: string, messageId: string, emoji: string, meId: string) => Promise<void>;

  /** Reload unsent messages from disk so a kill mid-send is not data loss. */
  hydratePending: () => Promise<void>;
  /** Re-send everything still queued. Safe to call repeatedly. */
  flushOutbox: () => Promise<void>;
};

const emptyConv = (): ConvState => ({ messages: [], typingUserIds: new Set() });

/** Receipts only ever move forward, so out-of-order events cannot regress. */
const STATUS_ORDER: Record<Message['status'], number> = {
  sending: 0,
  failed: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

const statusRank = (s: Message['status']): number => STATUS_ORDER[s] ?? 0;

/** Newest first — the chat list renders inverted. */
function orderDesc(a: Message, b: Message): number {
  if (a.createdAt === b.createdAt) return a.id.localeCompare(b.id) * -1;
  return a.createdAt < b.createdAt ? 1 : -1;
}

const isLocalId = (id: string): boolean => id.startsWith('cm_');

const persist = (msgs: Message[]): void => {
  /* An in-flight upload has no durable URL yet, so it stays out of the cache. */
  const durable = msgs.filter((m) => m.uploadProgress == null);
  if (durable.length) void localCache.upsertMessages(durable).catch(() => {});
};

function payloadFor(msg: Message): SendPayload {
  return msg.type === 'text'
    ? {
        conversationId: msg.conversationId,
        clientMessageId: msg.clientMessageId!,
        type: 'text',
        body: msg.body ?? '',
        replyToId: msg.replyToId ?? null,
      }
    : {
        conversationId: msg.conversationId,
        clientMessageId: msg.clientMessageId!,
        type: msg.type,
        media: msg.media,
        replyToId: msg.replyToId ?? null,
      };
}

export const useMessageStore = create<MessageState>((set, get) => ({
  byConv: {},

  ensure: (conversationId) => {
    if (!get().byConv[conversationId]) {
      set((s) => ({ byConv: { ...s.byConv, [conversationId]: emptyConv() } }));
    }
  },

  prepend: (conversationId, msgs) => {
    if (!msgs.length) {
      get().ensure(conversationId);
      return;
    }
    set((s) => {
      const prev = s.byConv[conversationId] ?? emptyConv();
      const existing = new Map(prev.messages.map((m) => [m.id, m] as const));
      for (const m of msgs) {
        /* Keep a local pending row rather than letting a server copy with a
           different id duplicate it; `upsert` reconciles them by client id. */
        const prior = existing.get(m.id);
        existing.set(m.id, prior ? { ...prior, ...m } : m);
      }
      const merged = Array.from(existing.values()).sort(orderDesc);
      return { byConv: { ...s.byConv, [conversationId]: { ...prev, messages: merged } } };
    });
    persist(msgs);
  },

  upsert: (conversationId, msg) => {
    let replacedLocalId: string | null = null;

    set((s) => {
      const prev = s.byConv[conversationId] ?? emptyConv();
      const byClient = msg.clientMessageId
        ? prev.messages.findIndex((m) => m.clientMessageId === msg.clientMessageId)
        : -1;
      const byId = prev.messages.findIndex((m) => m.id === msg.id);
      const idx = byClient !== -1 ? byClient : byId;

      if (idx !== -1) {
        const current = prev.messages[idx]!;
        if (isLocalId(current.id) && !isLocalId(msg.id)) replacedLocalId = current.id;
      }

      const next =
        idx === -1
          ? [msg, ...prev.messages]
          : prev.messages.map((m, i) => (i === idx ? { ...m, ...msg } : m));

      return {
        byConv: {
          ...s.byConv,
          [conversationId]: { ...prev, messages: next.sort(orderDesc) },
        },
      };
    });

    /* The server assigned a real id: drop the local placeholder row so the
       outbox does not try to send it again after a restart. */
    if (replacedLocalId) void localCache.deleteMessage(replacedLocalId).catch(() => {});
    persist([msg]);
  },

  markDeleted: (conversationId, id) => {
    const deletedAt = new Date().toISOString();
    set((s) => {
      const prev = s.byConv[conversationId];
      if (!prev) return s;
      return {
        byConv: {
          ...s.byConv,
          [conversationId]: {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === id
                ? { ...m, body: undefined, media: undefined, reactions: [], deletedAt }
                : m,
            ),
          },
        },
      };
    });
    const msg = get().byConv[conversationId]?.messages.find((m) => m.id === id);
    if (msg) persist([msg]);
  },

  markEdited: (conversationId, id, body, editedAt) => {
    set((s) => {
      const prev = s.byConv[conversationId];
      if (!prev) return s;
      return {
        byConv: {
          ...s.byConv,
          [conversationId]: {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === id ? { ...m, body: body ?? undefined, editedAt } : m,
            ),
          },
        },
      };
    });
    const msg = get().byConv[conversationId]?.messages.find((m) => m.id === id);
    if (msg) persist([msg]);
  },

  markStatus: (conversationId, ids, status) => {
    if (!ids.length) return;
    const wanted = new Set(ids);
    set((s) => {
      const prev = s.byConv[conversationId];
      if (!prev) return s;
      return {
        byConv: {
          ...s.byConv,
          [conversationId]: {
            ...prev,
            messages: prev.messages.map((m) =>
              wanted.has(m.id) && statusRank(status) > statusRank(m.status) ? { ...m, status } : m,
            ),
          },
        },
      };
    });
    const touched = (get().byConv[conversationId]?.messages ?? []).filter((m) => wanted.has(m.id));
    persist(touched);
  },

  setReactions: (conversationId, id, reactions) => {
    set((s) => {
      const prev = s.byConv[conversationId];
      if (!prev) return s;
      return {
        byConv: {
          ...s.byConv,
          [conversationId]: {
            ...prev,
            messages: prev.messages.map((m) => (m.id === id ? { ...m, reactions } : m)),
          },
        },
      };
    });
    const msg = get().byConv[conversationId]?.messages.find((m) => m.id === id);
    if (msg) persist([msg]);
  },

  setTyping: (conversationId, userId, isTyping) => {
    set((s) => {
      const prev = s.byConv[conversationId] ?? emptyConv();
      const next = new Set(prev.typingUserIds);
      if (isTyping) next.add(userId);
      else next.delete(userId);
      return { byConv: { ...s.byConv, [conversationId]: { ...prev, typingUserIds: next } } };
    });
  },

  send: async ({ conversationId, senderId, body, replyToId }) => {
    const cmid = clientMessageId();
    await enqueue(get, {
      id: cmid,
      clientMessageId: cmid,
      conversationId,
      senderId,
      type: 'text',
      body,
      replyToId: replyToId ?? null,
      status: 'sending',
      createdAt: new Date().toISOString(),
    });
  },

  sendMedia: async ({ conversationId, senderId, type, media, replyToId }) => {
    const cmid = clientMessageId();
    await enqueue(get, {
      id: cmid,
      clientMessageId: cmid,
      conversationId,
      senderId,
      type,
      media,
      replyToId: replyToId ?? null,
      status: 'sending',
      createdAt: new Date().toISOString(),
    });
  },

  sendMediaFile: async ({ conversationId, senderId, asset, replyToId }) => {
    const cmid = clientMessageId();
    const base: Message = {
      id: cmid,
      clientMessageId: cmid,
      conversationId,
      senderId,
      type: asset.kind === 'video' ? 'video' : 'image',
      media: {
        /* Local file URI: the preview renders immediately from disk. */
        url: asset.uri,
        mime: asset.mime,
        width: asset.width,
        height: asset.height,
        duration: asset.duration,
        size: asset.size,
      },
      replyToId: replyToId ?? null,
      status: 'sending',
      uploadProgress: 0,
      createdAt: new Date().toISOString(),
    };
    get().upsert(conversationId, base);

    let uploaded: MediaRef;
    try {
      uploaded = await mediaService.upload(asset, (loaded, total) => {
        if (total > 0) {
          get().upsert(conversationId, {
            ...base,
            uploadProgress: Math.min(0.99, loaded / total),
          });
        }
      });
    } catch (e) {
      get().upsert(conversationId, { ...base, status: 'failed', uploadProgress: undefined });
      throw e;
    }

    const ready: Message = {
      ...base,
      media: uploaded,
      uploadProgress: undefined,
      status: 'sending',
    };
    get().upsert(conversationId, ready);
    await deliver(get, ready);
  },

  retry: async (conversationId, cmid) => {
    const msg = get().byConv[conversationId]?.messages.find((m) => m.clientMessageId === cmid);
    if (!msg) return;
    if (msg.type === 'text' && !msg.body) return;
    get().upsert(conversationId, { ...msg, status: 'sending' });
    await deliver(get, { ...msg, status: 'sending' });
  },

  edit: async (conversationId, messageId, body) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const prior = get().byConv[conversationId]?.messages.find((m) => m.id === messageId);
    get().markEdited(conversationId, messageId, trimmed, new Date().toISOString());
    try {
      const res = await socketClient.emitWithAck<{ ok: boolean }>('message:edit', {
        messageId,
        body: trimmed,
      });
      if (!res.ok) throw new Error('edit_rejected');
    } catch (e) {
      /* Roll the optimistic edit back to the server truth. */
      if (prior) {
        get().markEdited(
          conversationId,
          messageId,
          prior.body ?? null,
          prior.editedAt ?? new Date(0).toISOString(),
        );
      }
      throw e;
    }
  },

  remove: async (conversationId, messageId) => {
    const prior = get().byConv[conversationId]?.messages.find((m) => m.id === messageId);
    get().markDeleted(conversationId, messageId);
    try {
      const res = await socketClient.emitWithAck<{ ok: boolean }>('message:delete', { messageId });
      if (!res.ok) throw new Error('delete_rejected');
    } catch (e) {
      if (prior) get().upsert(conversationId, prior);
      throw e;
    }
  },

  hide: async (conversationId, messageId) => {
    const prior = get().byConv[conversationId]?.messages ?? [];
    const target = prior.find((m) => m.id === messageId);
    /* Optimistic: drop it from view, restore if the server refuses. */
    set((state) => ({
      byConv: {
        ...state.byConv,
        [conversationId]: {
          ...(state.byConv[conversationId] ?? { messages: [], typingUserIds: new Set<string>() }),
          messages: prior.filter((m) => m.id !== messageId),
        },
      },
    }));
    try {
      await messagesApi.hide(messageId);
      await localCache.deleteMessage(messageId).catch(() => {});
    } catch (e) {
      if (target) get().upsert(conversationId, target);
      throw e;
    }
  },

  clearConversation: async (conversationId) => {
    set((state) => ({
      byConv: {
        ...state.byConv,
        [conversationId]: {
          ...(state.byConv[conversationId] ?? { typingUserIds: new Set<string>() }),
          messages: [],
          typingUserIds: state.byConv[conversationId]?.typingUserIds ?? new Set<string>(),
        },
      },
    }));
    await localCache.deleteConversationMessages(conversationId).catch(() => {});
  },

  react: async (conversationId, messageId, emoji, meId) => {
    const msg = get().byConv[conversationId]?.messages.find((m) => m.id === messageId);
    if (!msg) return;
    const prior = msg.reactions ?? [];

    /* Mirror the server rule: one reaction per user, same emoji toggles off. */
    const mine = prior.find((r) => r.userId === meId);
    const optimistic = prior.filter((r) => r.userId !== meId);
    if (!mine || mine.emoji !== emoji) {
      optimistic.push({ userId: meId, emoji, at: new Date().toISOString() });
    }
    get().setReactions(conversationId, messageId, optimistic);

    try {
      const res = await socketClient.emitWithAck<{ ok: boolean }>('message:react', {
        messageId,
        emoji,
      });
      if (!res.ok) throw new Error('react_rejected');
    } catch (e) {
      get().setReactions(conversationId, messageId, prior);
      throw e;
    }
  },

  hydratePending: async () => {
    const pending = await localCache.loadPending().catch(() => [] as Message[]);
    if (!pending.length) return;
    const byConv = new Map<string, Message[]>();
    for (const m of pending) {
      const list = byConv.get(m.conversationId) ?? [];
      list.push(m);
      byConv.set(m.conversationId, list);
    }
    for (const [convId, msgs] of byConv) get().prepend(convId, msgs);
  },

  flushOutbox: async () => {
    if (!socketClient.isConnected()) return;
    const queued: Message[] = [];
    for (const conv of Object.values(get().byConv)) {
      for (const m of conv.messages) {
        /* Skip attachments whose bytes are still uploading. */
        if (m.status === 'sending' && m.clientMessageId && m.uploadProgress == null) {
          queued.push(m);
        }
      }
    }
    queued.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    /* Sequential: preserves the order the user typed them in. */
    for (const msg of queued) await deliver(get, msg);
  },
}));

type Getter = () => MessageState;

/** Optimistically add a message, persist it, then try to deliver it. */
async function enqueue(get: Getter, optimistic: Message): Promise<void> {
  get().upsert(optimistic.conversationId, optimistic);
  await deliver(get, optimistic);
}

/**
 * Attempt one delivery. Offline leaves the message queued (`sending`) for the
 * next flush; a server rejection or an ack timeout marks it `failed` so the
 * user can retry explicitly. Idempotency is the server's `clientMessageId`
 * unique index, so a retry can never duplicate a message.
 */
async function deliver(get: Getter, msg: Message): Promise<void> {
  if (!msg.clientMessageId) return;
  const convId = msg.conversationId;

  if (!socketClient.isConnected()) return;

  try {
    const res = await socketClient.emitWithAck<AckWith<{ message: Message }>>(
      'message:send',
      payloadFor(msg),
    );
    if (res.ok) {
      get().upsert(convId, {
        ...res.message,
        clientMessageId: msg.clientMessageId,
        status: res.message.status ?? 'sent',
      });
    } else {
      get().upsert(convId, { ...msg, status: 'failed' });
    }
  } catch (e) {
    const reason = e instanceof Error ? e.message : '';
    /* `offline` means we never got on the wire: stay queued, do not fail. */
    if (reason !== 'offline') {
      get().upsert(convId, { ...msg, status: 'failed' });
    }
  }
}

/* Flush the outbox whenever the socket comes back up. Registered once, at
   module scope, so it survives screen mounts and unmounts. */
socketClient.onStatus((status) => {
  if (status === 'connected') {
    void useMessageStore.getState().flushOutbox();
  }
});
