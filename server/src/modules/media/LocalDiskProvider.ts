import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { Errors } from '../../lib/errors';
import {
  allowedMimeFor,
  PUBLIC_ID_PATTERN,
  type ConfirmInput,
  type MediaKind,
  type MediaProvider,
  type MediaRef,
  type SignedUpload,
} from './MediaProvider';

/** Upload tickets are short-lived; a stale one cannot be replayed later. */
const TICKET_TTL_SECONDS = 10 * 60;

/** Sidecar suffix holding an object's content type. Never served. */
export const META_SUFFIX = '.meta';

export type StoredMeta = { mime: string; size: number };

export type UploadTicket = {
  /** Object key, always `u_<userId>/<kind>/<name>`. */
  pid: string;
  kind: MediaKind;
  /** Server-side byte cap for this ticket. */
  max: number;
};

export const mediaRoot = (): string => path.resolve(process.cwd(), env.MEDIA_LOCAL_DIR);

/**
 * Resolve an object key to an absolute path, refusing anything that escapes
 * the storage root even if the key pattern check is ever relaxed.
 */
export function resolveObjectPath(publicId: string): string {
  if (!PUBLIC_ID_PATTERN.test(publicId) || publicId.endsWith(META_SUFFIX)) {
    throw Errors.badRequest('bad_public_id', 'Malformed media id');
  }
  const root = mediaRoot();
  const full = path.resolve(root, publicId);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw Errors.forbidden('Media id escapes storage root');
  }
  return full;
}

export async function writeMeta(objectPath: string, meta: StoredMeta): Promise<void> {
  await fs.writeFile(`${objectPath}${META_SUFFIX}`, JSON.stringify(meta), 'utf8');
}

/** Content type recorded at upload time; objects carry no file extension. */
export async function readMeta(objectPath: string): Promise<StoredMeta | null> {
  try {
    const raw = await fs.readFile(`${objectPath}${META_SUFFIX}`, 'utf8');
    const parsed = JSON.parse(raw) as StoredMeta;
    return typeof parsed?.mime === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export const signTicket = (ticket: UploadTicket): string =>
  jwt.sign(ticket, env.JWT_ACCESS_SECRET, { expiresIn: TICKET_TTL_SECONDS });

export function verifyTicket(token: string): UploadTicket {
  try {
    const claims = jwt.verify(token, env.JWT_ACCESS_SECRET) as UploadTicket;
    if (!claims?.pid || !claims?.kind || !claims?.max) throw new Error('bad ticket');
    return claims;
  } catch {
    throw Errors.unauthorized('Upload ticket is invalid or expired');
  }
}

const maxBytesFor = (kind: MediaKind): number =>
  kind === 'image' ? env.MEDIA_MAX_IMAGE_BYTES : env.MEDIA_MAX_VIDEO_BYTES;

/**
 * Stores media on the server's own disk and serves it back through an
 * authorized route. Chosen when `MEDIA_PROVIDER=local` — it keeps media
 * working (and persistent) without third-party credentials, and keeps private
 * files behind the same membership checks as the messages that carry them.
 */
export const localDiskProvider: MediaProvider = {
  name: 'local',

  async signUpload(userId, kind): Promise<SignedUpload> {
    const name = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const publicId = `u_${userId}/${kind}/${name}`;
    const max = maxBytesFor(kind);
    const token = signTicket({ pid: publicId, kind, max });

    return {
      provider: 'local',
      transport: 'raw',
      uploadUrl: `${env.PUBLIC_BASE_URL}/api/media/upload?token=${encodeURIComponent(token)}`,
      params: {},
      publicIdPrefix: publicId,
      maxBytes: max,
      expiresAt: new Date(Date.now() + TICKET_TTL_SECONDS * 1000).toISOString(),
    };
  },

  async confirm(userId, input: ConfirmInput): Promise<MediaRef> {
    if (!allowedMimeFor(input.kind).has(input.mime)) {
      throw Errors.badRequest('bad_mime', `Unsupported ${input.kind} type: ${input.mime}`);
    }
    if (!input.publicId.startsWith(`u_${userId}/${input.kind}/`)) {
      throw Errors.forbidden('publicId does not belong to caller');
    }

    const full = resolveObjectPath(input.publicId);
    const stat = await fs.stat(full).catch(() => null);
    if (!stat?.isFile()) throw Errors.badRequest('not_uploaded', 'No uploaded file for that id');

    const limit = maxBytesFor(input.kind);
    if (stat.size > limit) {
      await fs.unlink(full).catch(() => {});
      throw Errors.badRequest('too_large', 'File exceeds size limit');
    }

    /* Trust the recorded type over the client's claim: it was validated
       against the allowlist when the bytes were written. */
    const stored = await readMeta(full);
    if (stored && stored.mime !== input.mime) {
      throw Errors.badRequest('mime_mismatch', 'Declared type does not match the uploaded file');
    }

    return {
      url: `${env.PUBLIC_BASE_URL}/api/media/file/${input.publicId}`,
      mime: input.mime,
      width: input.width,
      height: input.height,
      duration: input.duration,
      size: stat.size,
    };
  },
};
