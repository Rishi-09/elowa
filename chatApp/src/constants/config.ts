import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

export const config = {
  apiBaseUrl: extra.API_BASE_URL ?? 'http://localhost:4000/api',
  socketUrl: extra.SOCKET_URL ?? 'http://localhost:4000',
};

export const storageKeys = {
  accessToken: 'auth.accessToken',
  refreshToken: 'auth.refreshToken',
  userId: 'auth.userId',
} as const;
