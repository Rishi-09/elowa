import type { RequestHandler } from 'express';
import { authService } from './auth.service';
import { ok } from '../../lib/response';

export const authController: {
  register: RequestHandler;
  login: RequestHandler;
  refresh: RequestHandler;
  logout: RequestHandler;
} = {
  register: async (req, res, next) => {
    try {
      const result = await authService.register(req.body);
      ok(res, result, 201);
    } catch (e) {
      next(e);
    }
  },
  login: async (req, res, next) => {
    try {
      const result = await authService.login(req.body);
      ok(res, result);
    } catch (e) {
      next(e);
    }
  },
  refresh: async (req, res, next) => {
    try {
      const result = await authService.refresh(req.body.refreshToken);
      ok(res, result);
    } catch (e) {
      next(e);
    }
  },
  logout: async (req, res, next) => {
    try {
      await authService.logout(req.body?.refreshToken);
      ok(res, { ok: true });
    } catch (e) {
      next(e);
    }
  },
};
