export type MediaKind = 'image' | 'video';

export type SignedUpload = {
  provider: 'local' | 'cloudinary' | 's3' | 'r2';
  /**
   * How the client must transmit the bytes:
   *  - `form` POSTs a multipart form with `params` (Cloudinary/S3 style)
   *  - `raw`  PUTs the file body directly to `uploadUrl`
   */
  transport: 'form' | 'raw';
  uploadUrl: string;
  params: Record<string, string | number>;
  publicIdPrefix: string;
  maxBytes: number;
  expiresAt: string;
};

export type ConfirmInput = {
  publicId: string;
  kind: MediaKind;
  mime: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
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

/** Shared across providers: what a client may upload, and how big. */
export const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
export const ALLOWED_VIDEO_MIME = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export const allowedMimeFor = (kind: MediaKind): Set<string> =>
  kind === 'image' ? ALLOWED_IMAGE_MIME : ALLOWED_VIDEO_MIME;

/**
 * Object keys are always `u_<userId>/<kind>/<name>`. Enforced on confirm and
 * on upload so a caller can neither overwrite nor read another user's assets,
 * and so no key can escape the storage root via path traversal.
 */
export const PUBLIC_ID_PATTERN = /^u_[a-f0-9]{24}\/(image|video)\/[A-Za-z0-9_.-]{1,80}$/;

export interface MediaProvider {
  readonly name: SignedUpload['provider'];
  signUpload(userId: string, kind: MediaKind): Promise<SignedUpload>;
  confirm(userId: string, input: ConfirmInput): Promise<MediaRef>;
}
