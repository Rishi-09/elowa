export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export const Errors = {
  unauthorized: (msg = 'Unauthorized') => new AppError('unauthorized', msg, 401),
  forbidden: (msg = 'Forbidden') => new AppError('forbidden', msg, 403),
  notFound: (msg = 'Not found') => new AppError('not_found', msg, 404),
  conflict: (msg = 'Conflict') => new AppError('conflict', msg, 409),
  badRequest: (code: string, msg: string) => new AppError(code, msg, 400),
};
