import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validateQuery } from '../../middleware/validate';
import { tenorProvider } from './TenorProvider';
import { ok } from '../../lib/response';

const searchQuery = z.object({
  q: z.string().trim().min(1).max(64),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

const trendingQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

const search: RequestHandler = async (req, res, next) => {
  try {
    const { q, limit } = (req as unknown as { validatedQuery: z.infer<typeof searchQuery> })
      .validatedQuery;
    ok(res, await tenorProvider.search(q, limit));
  } catch (e) {
    next(e);
  }
};

const trending: RequestHandler = async (req, res, next) => {
  try {
    const { limit } = (req as unknown as { validatedQuery: z.infer<typeof trendingQuery> })
      .validatedQuery;
    ok(res, await tenorProvider.trending(limit));
  } catch (e) {
    next(e);
  }
};

export const gifsRouter = Router();
gifsRouter.use(requireAuth);
gifsRouter.get('/search', validateQuery(searchQuery), search);
gifsRouter.get('/trending', validateQuery(trendingQuery), trending);
