import { api } from '@/services/api';
import type { Message } from '@/types';

export type MessagesPage = { items: Message[]; nextCursor: string | null };

export const messagesApi = {
  /** Cursor-paginated history, newest first. */
  list: (conversationId: string, opts: { limit?: number; before?: string | null } = {}) => {
    const params = new URLSearchParams({ limit: String(opts.limit ?? 30) });
    if (opts.before) params.set('before', opts.before);
    return api.get<MessagesPage>(`/conversations/${conversationId}/messages?${params}`);
  },

  search: (conversationId: string, q: string, limit = 20) => {
    const params = new URLSearchParams({ q, limit: String(limit) });
    return api.get<Message[]>(`/conversations/${conversationId}/messages/search?${params}`);
  },

  react: (messageId: string, emoji: string) =>
    api.post<Message>(`/messages/${messageId}/reactions`, { emoji }),

  /** Delete for me: hides the message from this user, including others'. */
  hide: (messageId: string) => api.post<{ hidden: true }>(`/messages/${messageId}/hide`),
};
