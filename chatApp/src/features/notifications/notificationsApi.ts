import { api } from '@/services/api';

export type PushPrefs = {
  enabled: boolean;
  showPreview: boolean;
};

export const notificationsApi = {
  registerToken: (token: string) =>
    api.post<{ ok: true }>('/devices/push-token', { token }),
  unregister: () => api.del<{ ok: true }>('/devices/push-token'),
  getPrefs: () => api.get<PushPrefs>('/devices/push-prefs'),
  setPrefs: (prefs: Partial<PushPrefs>) =>
    api.patch<PushPrefs>('/devices/push-prefs', prefs),
};
