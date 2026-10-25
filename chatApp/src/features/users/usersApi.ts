import { api } from '@/services/api';
import type { User } from '@/types';

export const usersApi = {
  search: (q: string, limit = 10) =>
    api.get<User[]>(`/users/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  getById: (id: string) => api.get<User>(`/users/${id}`),
};
