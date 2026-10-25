export type PrivacyPrefs = {
  showPresence: boolean;
  showReadReceipts: boolean;
  searchable: boolean;
};

export type User = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  isOnline?: boolean;
  lastSeenAt?: string | null;
  /** Present only on the signed-in user's own profile. */
  privacy?: PrivacyPrefs;
};

export type MessageType = 'text' | 'image' | 'video' | 'gif' | 'sticker';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type MediaRef = {
  url: string;
  mime: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbUrl?: string;
  size?: number;
};

/** Emoji reactions are user content, so the emoji itself is the value. */
export type MessageReaction = {
  userId: string;
  emoji: string;
  at?: string;
};

export type Message = {
  id: string;
  clientMessageId?: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  body?: string;
  media?: MediaRef;
  replyToId?: string | null;
  reactions?: MessageReaction[];
  status: MessageStatus;
  /**
   * Client-only: 0..1 while an attachment is still uploading. Present means
   * the bytes have not reached storage yet, so the message is not persisted
   * to the local cache and is never replayed from the outbox.
   */
  uploadProgress?: number;
  editedAt?: string | null;
  deletedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
};

export type ConversationType = 'direct' | 'group';

export type Conversation = {
  id: string;
  type: ConversationType;
  participantIds: string[];
  /** For groups this is a synthetic entry carrying the group name and avatar. */
  peer: User;
  /** Group fields; `title` is null on direct conversations. */
  title?: string | null;
  avatarUrl?: string | null;
  adminIds: string[];
  members: User[];
  lastMessage?: Pick<Message, 'id' | 'type' | 'body' | 'createdAt' | 'senderId'> | null;
  lastMessageAt?: string | null;
  unreadCount: number;
  disappearingTtlSeconds?: number | null;
};
