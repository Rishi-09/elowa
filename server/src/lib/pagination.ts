import { Types } from 'mongoose';

export type Cursor = { createdAt: Date; id: Types.ObjectId };

export function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.createdAt.toISOString()}|${c.id.toString()}`).toString('base64url');
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const [ts, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
    if (!ts || !id) return null;
    return { createdAt: new Date(ts), id: new Types.ObjectId(id) };
  } catch {
    return null;
  }
}
