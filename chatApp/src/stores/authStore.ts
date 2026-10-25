import { create } from 'zustand';
import { secureStorage } from '@/services/secureStorage';
import { storageKeys } from '@/constants/config';
import { ApiError, primeAccessToken } from '@/services/api';
import { profileApi } from '@/features/profile/profileApi';
import type { PrivacyPrefs, User } from '@/types';
import { notificationService } from '@/features/notifications/notificationService';

type AuthState = {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  user: User | null;
  accessToken: string | null;
  restore: () => Promise<void>;
  setSession: (session: { user: User; accessToken: string; refreshToken: string }) => Promise<void>;
  /** Refresh the cached profile from the server (after an edit, or on resume). */
  refreshProfile: () => Promise<void>;
  setUser: (user: User) => void;
  setPrivacy: (privacy: PrivacyPrefs) => void;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  accessToken: null,

  /**
   * Restore a stored session on launch.
   *
   * The stored token is treated as a claim, not proof: we fetch the profile to
   * confirm the session is still valid (the API client transparently refreshes
   * an expired access token). A definitive 401 means the session is gone, so we
   * sign out rather than leaving the app in a half-authenticated state.
   */
  restore: async () => {
    const [access, userId] = await Promise.all([
      secureStorage.get(storageKeys.accessToken),
      secureStorage.get(storageKeys.userId),
    ]);

    if (!access || !userId) {
      set({ status: 'unauthenticated', accessToken: null, user: null });
      return;
    }

    primeAccessToken(access);
    /* Optimistic: render the app shell while the profile check is in flight. */
    set({
      status: 'authenticated',
      accessToken: access,
      user: { id: userId, username: '', displayName: '' },
    });

    try {
      const me = await profileApi.me();
      set({ user: me });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await get().signOut();
        return;
      }
      /* Offline: keep the restored session and retry when the network returns. */
    }
  },

  setSession: async ({ user, accessToken, refreshToken }) => {
    await Promise.all([
      secureStorage.set(storageKeys.accessToken, accessToken),
      secureStorage.set(storageKeys.refreshToken, refreshToken),
      secureStorage.set(storageKeys.userId, user.id),
    ]);
    primeAccessToken(accessToken);
    set({ status: 'authenticated', user, accessToken });
  },

  refreshProfile: async () => {
    if (get().status !== 'authenticated') return;
    try {
      set({ user: await profileApi.me() });
    } catch {
      /* Keep the cached profile; this is a background refresh. */
    }
  },

  setUser: (user) => set({ user }),

  setPrivacy: (privacy) => {
    const user = get().user;
    if (user) set({ user: { ...user, privacy } });
  },

  signOut: async () => {
    await notificationService.unregister().catch(() => {});
    await Promise.all([
      secureStorage.remove(storageKeys.accessToken),
      secureStorage.remove(storageKeys.refreshToken),
      secureStorage.remove(storageKeys.userId),
    ]);
    primeAccessToken(null);
    set({ status: 'unauthenticated', user: null, accessToken: null });
  },
}));
