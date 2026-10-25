import { api } from '@/services/api';
import type { Conversation } from '@/types';

export const conversationsApi = {
  list: () => api.get<Conversation[]>('/conversations'),
  get: (id: string) => api.get<Conversation>(`/conversations/${id}`),

  /** Direct conversations are idempotent: the same pair always resolves to one. */
  create: (peerUserId: string) => api.post<Conversation>('/conversations', { peerUserId }),

  createGroup: (title: string, memberIds: string[]) =>
    api.post<Conversation>('/conversations/group', { title, memberIds }),

  setDisappearing: (id: string, seconds: number | null) =>
    api.patch<Conversation>(`/conversations/${id}`, { disappearingTtlSeconds: seconds }),

  updateGroup: (id: string, patch: { title?: string; avatarUrl?: string | null }) =>
    api.patch<Conversation>(`/conversations/${id}`, patch),

  addMembers: (id: string, userIds: string[]) =>
    api.post<Conversation>(`/conversations/${id}/members`, { userIds }),

  removeMember: (id: string, userId: string) =>
    api.del<Conversation>(`/conversations/${id}/members/${userId}`),

  setAdmin: (id: string, userId: string, admin: boolean) =>
    api.patch<Conversation>(`/conversations/${id}/members/${userId}/admin`, { admin }),

  leaveGroup: (id: string) => api.post<{ left: true }>(`/conversations/${id}/leave`),
};
