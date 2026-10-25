import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { fail } from '../lib/response';
import { logger } from '../lib/logger';

export const notFound: RequestHandler = (_req, res) => fail(res, 404, 'not_found', 'Route not found');

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return fail(res, 400, 'validation_error', err.issues[0]?.message ?? 'Invalid input');
  }
  if (err instanceof AppError) {
    return fail(res, err.status, err.code, err.message);
  }
  logger.error({ err }, 'unhandled error');
  return fail(res, 500, 'internal_error', 'Something went wrong');
};
