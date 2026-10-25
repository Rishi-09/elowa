export type ClientToServer = {
  'conversation:join': (p: { conversationId: string }, cb?: (res: Ack) => void) => void;
  'conversation:leave': (p: { conversationId: string }) => void;
  'message:send': (
    p: {
      conversationId: string;
      clientMessageId: string;
      type: 'text' | 'image' | 'video' | 'gif' | 'sticker';
      body?: string | null;
      media?: unknown;
      replyToId?: string | null;
    },
    cb: (res: AckWith<{ message: unknown }>) => void,
  ) => void;
  'message:edit': (p: { messageId: string; body: string }, cb?: (res: Ack) => void) => void;
  'message:delete': (p: { messageId: string }, cb?: (res: Ack) => void) => void;
  'message:read': (p: { conversationId: string; uptoMessageId: string }) => void;
  'message:react': (p: { messageId: string; emoji: string }, cb?: (res: Ack) => void) => void;
  'typing:start': (p: { conversationId: string }) => void;
  'typing:stop': (p: { conversationId: string }) => void;
};

export type ServerToClient = {
  'message:new': (m: unknown) => void;
  'message:updated': (p: { id: string; body: string | null; editedAt: string }) => void;
  'message:deleted': (p: { id: string }) => void;
  /** One receipt can cover many messages — a reader catches up in bulk. */
  'message:status': (p: { ids: string[]; status: 'delivered' | 'read'; at: string }) => void;
  'message:reactions': (p: {
    id: string;
    conversationId: string;
    reactions: unknown;
  }) => void;
  'typing:update': (p: { conversationId: string; userId: string; isTyping: boolean }) => void;
  'presence:update': (p: { userId: string; isOnline: boolean; lastSeenAt: string | null }) => void;
};

export type SocketData = { userId: string };

export type Ack = { ok: true } | { ok: false; code: string; message: string };
export type AckWith<T> = (T & { ok: true }) | { ok: false; code: string; message: string };
