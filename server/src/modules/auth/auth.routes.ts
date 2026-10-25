import { Router } from 'express';
import { authController } from './auth.controller';
import { loginBody, refreshBody, registerBody } from './auth.dto';
import { validateBody } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rateLimit';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validateBody(registerBody), authController.register);
authRouter.post('/login', authLimiter, validateBody(loginBody), authController.login);
authRouter.post('/refresh', validateBody(refreshBody), authController.refresh);
authRouter.post('/logout', authController.logout);
