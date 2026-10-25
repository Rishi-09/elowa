import { api } from '@/services/api';

export type MediaKind = 'image' | 'video';

export type SignedUpload = {
  provider: 'local' | 'cloudinary' | 's3' | 'r2';
  /** `raw` PUTs the bytes directly; `form` posts a multipart form. */
  transport: 'form' | 'raw';
  uploadUrl: string;
  params: Record<string, string | number>;
  publicIdPrefix: string;
  maxBytes: number;
  expiresAt: string;
};

export type MediaRef = {
  url: string;
  mime: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbUrl?: string;
  size?: number;
};

export const mediaApi = {
  sign: (kind: MediaKind) => api.post<SignedUpload>('/media/sign', { kind }),
  confirm: (body: {
    publicId: string;
    kind: MediaKind;
    mime: string;
    size?: number;
    width?: number;
    height?: number;
    duration?: number;
  }) => api.post<MediaRef>('/media/confirm', body),
};
