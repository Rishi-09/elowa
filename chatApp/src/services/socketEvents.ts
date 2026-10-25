import type { Message, MessageReaction, MessageType } from '@/types';

export type Ack = { ok: true } | { ok: false; code: string; message: string };
export type AckWith<T> = (T & { ok: true }) | { ok: false; code: string; message: string };

export type SendPayload = {
  conversationId: string;
  clientMessageId: string;
  type: MessageType;
  body?: string | null;
  media?: Message['media'] | null;
  replyToId?: string | null;
};

export type ServerToClientEvents = {
  'message:new': (m: Message) => void;
  'message:updated': (p: { id: string; body: string | null; editedAt: string }) => void;
  'message:deleted': (p: { id: string }) => void;
  /** One receipt can cover many messages: a reader catches up in bulk. */
  'message:status': (p: { ids: string[]; status: 'delivered' | 'read'; at: string }) => void;
  'message:reactions': (p: {
    id: string;
    conversationId: string;
    reactions: MessageReaction[];
  }) => void;
  'typing:update': (p: { conversationId: string; userId: string; isTyping: boolean }) => void;
  'presence:update': (p: { userId: string; isOnline: boolean; lastSeenAt: string | null }) => void;
};

export type ClientToServerEvents = {
  'conversation:join': (p: { conversationId: string }, cb?: (res: Ack) => void) => void;
  'conversation:leave': (p: { conversationId: string }) => void;
  'message:send': (p: SendPayload, cb: (res: AckWith<{ message: Message }>) => void) => void;
  'message:edit': (p: { messageId: string; body: string }, cb?: (res: Ack) => void) => void;
  'message:delete': (p: { messageId: string }, cb?: (res: Ack) => void) => void;
  'message:read': (p: { conversationId: string; uptoMessageId: string }) => void;
  'message:react': (p: { messageId: string; emoji: string }, cb?: (res: Ack) => void) => void;
  'typing:start': (p: { conversationId: string }) => void;
  'typing:stop': (p: { conversationId: string }) => void;
};
