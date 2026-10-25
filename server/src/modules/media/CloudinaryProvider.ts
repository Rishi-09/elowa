import crypto from 'node:crypto';
import { env } from '../../config/env';
import { Errors } from '../../lib/errors';
import {
  allowedMimeFor,
  type ConfirmInput,
  type MediaProvider,
  type MediaRef,
  type SignedUpload,
} from './MediaProvider';

function assertConfigured(): void {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw Errors.badRequest('media_not_configured', 'Media provider is not configured');
  }
}

function signParams(params: Record<string, string | number>, secret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + secret).digest('hex');
}

export const cloudinaryProvider: MediaProvider = {
  name: 'cloudinary',

  async signUpload(userId, kind): Promise<SignedUpload> {
    assertConfigured();
    const resourceType = kind === 'image' ? 'image' : 'video';
    const folder = `elowa/u_${userId}/${kind}`;
    const publicId = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const expiresAt = new Date((timestamp + 10 * 60) * 1000).toISOString();

    const toSign: Record<string, string | number> = {
      folder,
      public_id: publicId,
      timestamp,
    };
    const signature = signParams(toSign, env.CLOUDINARY_API_SECRET!);

    return {
      provider: 'cloudinary',
      transport: 'form',
      uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
      params: {
        ...toSign,
        api_key: env.CLOUDINARY_API_KEY!,
        signature,
      },
      publicIdPrefix: `${folder}/${publicId}`,
      maxBytes: kind === 'image' ? env.MEDIA_MAX_IMAGE_BYTES : env.MEDIA_MAX_VIDEO_BYTES,
      expiresAt,
    };
  },

  async confirm(userId, input: ConfirmInput): Promise<MediaRef> {
    assertConfigured();
    if (!allowedMimeFor(input.kind).has(input.mime)) {
      throw Errors.badRequest('bad_mime', `Unsupported ${input.kind} type: ${input.mime}`);
    }
    const limit = input.kind === 'image' ? env.MEDIA_MAX_IMAGE_BYTES : env.MEDIA_MAX_VIDEO_BYTES;
    if (input.size != null && input.size > limit) {
      throw Errors.badRequest('too_large', 'File exceeds size limit');
    }
    const expectedPrefix = `elowa/u_${userId}/${input.kind}/`;
    if (!input.publicId.startsWith(expectedPrefix)) {
      throw Errors.forbidden('publicId does not belong to caller');
    }

    const resourceType = input.kind === 'image' ? 'image' : 'video';
    const base = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
    const url = `${base}/${input.publicId}`;
    const thumbUrl =
      input.kind === 'video'
        ? `${base}/so_1,w_480,h_480,c_fill,q_auto,f_jpg/${input.publicId}.jpg`
        : `${base}/w_480,h_480,c_fill,q_auto,f_auto/${input.publicId}`;

    return {
      url,
      mime: input.mime,
      width: input.width,
      height: input.height,
      duration: input.duration,
      thumbUrl,
      size: input.size,
    };
  },
};
