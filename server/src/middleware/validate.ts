import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

export const validateBody =
  <T>(schema: ZodSchema<T>): RequestHandler =>
  (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    req.body = parsed.data as unknown as typeof req.body;
    next();
  };

export const validateQuery =
  <T>(schema: ZodSchema<T>): RequestHandler =>
  (req, _res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return next(parsed.error);
    (req as unknown as { validatedQuery: T }).validatedQuery = parsed.data;
    next();
  };
