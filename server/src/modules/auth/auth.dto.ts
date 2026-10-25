import { z } from 'zod';

export const registerBody = z.object({
  username: z.string().min(3).max(24).regex(/^[a-z0-9_]+$/i),
  displayName: z.string().min(1).max(48),
  password: z.string().min(6).max(128),
});

export const loginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const refreshBody = z.object({
  refreshToken: z.string().min(10),
});
