import { config, storageKeys } from '@/constants/config';
import { secureStorage } from './secureStorage';

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: { code: string; message: string } };
export type ApiResult<T> = ApiOk<T> | ApiErr;

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

/**
 * Last known access token, kept in memory alongside SecureStore so callers
 * that cannot await (image `headers`, for instance) can still authenticate.
 */
let accessTokenCache: string | null = null;

export const cachedAccessToken = (): string | null => accessTokenCache;

export const primeAccessToken = (token: string | null): void => {
  accessTokenCache = token;
};

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refreshToken = await secureStorage.get(storageKeys.refreshToken);
      if (!refreshToken) return false;
      const res = await fetch(`${config.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const json = (await res.json().catch(() => null)) as ApiResult<{
        accessToken: string;
        refreshToken: string;
      }> | null;
      if (!res.ok || !json || !json.ok) return false;
      await Promise.all([
        secureStorage.set(storageKeys.accessToken, json.data.accessToken),
        secureStorage.set(storageKeys.refreshToken, json.data.refreshToken),
      ]);
      accessTokenCache = json.data.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/**
 * Force an access-token refresh and return the fresh token, or null when the
 * session is unrecoverable. Shared with the socket client so the websocket can
 * re-handshake after the 10-minute access token expires.
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshed = await tryRefreshToken();
  if (!refreshed) return null;
  return secureStorage.get(storageKeys.accessToken);
}

export async function getAccessToken(): Promise<string | null> {
  const token = await secureStorage.get(storageKeys.accessToken);
  accessTokenCache = token;
  return token;
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, ...rest } = init;

  const doFetch = async () => {
    const h = new Headers(headers);
    h.set('Content-Type', 'application/json');
    if (auth) {
      const token = await secureStorage.get(storageKeys.accessToken);
      if (token) {
        accessTokenCache = token;
        h.set('Authorization', `Bearer ${token}`);
      }
    }
    return fetch(`${config.apiBaseUrl}${path}`, { ...rest, headers: h });
  };

  let res = await doFetch();

  if (res.status === 401 && auth && path !== '/auth/refresh') {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      res = await doFetch();
    }
  }

  const json = (await res.json().catch(() => null)) as ApiResult<T> | null;

  if (!res.ok || !json || !json.ok) {
    const code = json && !json.ok ? json.error.code : 'network_error';
    const message = json && !json.ok ? json.error.message : `Request failed (${res.status})`;
    throw new ApiError(code, message, res.status);
  }
  return json.data;
}

export const api = {
  get: <T>(path: string, auth = true) => request<T>(path, { method: 'GET', auth }),
  post: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}), auth }),
  patch: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}), auth }),
  del: <T>(path: string, auth = true) => request<T>(path, { method: 'DELETE', auth }),
};
