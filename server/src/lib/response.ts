import type { Response } from 'express';

export const ok = <T>(res: Response, data: T, status = 200) =>
  res.status(status).json({ ok: true, data });

export const fail = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ ok: false, error: { code, message } });
