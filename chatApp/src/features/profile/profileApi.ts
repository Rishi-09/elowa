import { api } from '@/services/api';
import type { PrivacyPrefs, User } from '@/types';

export type ProfilePatch = {
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
};

export const profileApi = {
  /** The signed-in user's own profile, including private preference fields. */
  me: () => api.get<User>('/profile'),
  update: (patch: ProfilePatch) => api.patch<User>('/profile', patch),
  getPrivacy: () => api.get<PrivacyPrefs>('/profile/privacy'),
  setPrivacy: (patch: Partial<PrivacyPrefs>) => api.patch<PrivacyPrefs>('/profile/privacy', patch),
};
