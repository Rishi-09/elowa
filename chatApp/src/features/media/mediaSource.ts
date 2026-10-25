import { cachedAccessToken } from '@/services/api';
import { config } from '@/constants/config';
import type { ImageSource } from 'expo-image';

/**
 * Build an image/video source for a stored media URL.
 *
 * The local media provider serves private files through an authorized route,
 * so requests for our own API host must carry the session token. Remote
 * provider URLs (Cloudinary, GIF CDNs) are passed through untouched.
 */
export function mediaSource(url?: string | null): ImageSource | undefined {
  if (!url) return undefined;

  const apiOrigin = config.apiBaseUrl.replace(/\/api\/?$/, '');
  if (!url.startsWith(`${apiOrigin}/api/media/`)) return { uri: url };

  const token = cachedAccessToken();
  return token ? { uri: url, headers: { Authorization: `Bearer ${token}` } } : { uri: url };
}
