import { api } from '@/services/api';
import type { User } from '@/types';

export type SessionResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

export const authApi = {
  login: (body: { username: string; password: string }) =>
    api.post<SessionResponse>('/auth/login', body, false),
  register: (body: { username: string; displayName: string; password: string }) =>
    api.post<SessionResponse>('/auth/register', body, false),
  logout: () => api.post<{ ok: true }>('/auth/logout'),
};
