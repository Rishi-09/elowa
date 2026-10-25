import mongoose from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';

let app: Express | null = null;

export async function getApp(): Promise<Express> {
  if (!mongoose.connection.readyState) {
    await mongoose.connect(process.env.MONGO_URI!);
  }
  if (!app) app = createApp();
  return app;
}

export async function resetDb(): Promise<void> {
  if (!mongoose.connection.readyState) {
    await mongoose.connect(process.env.MONGO_URI!);
  }
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function closeDb(): Promise<void> {
  await mongoose.disconnect();
  app = null;
}

export type Session = {
  user: { id: string; username: string; displayName: string };
  accessToken: string;
  refreshToken: string;
};

export async function register(
  app: Express,
  overrides: Partial<{ username: string; displayName: string; password: string }> = {},
): Promise<Session> {
  const username =
    overrides.username ?? `u${Math.random().toString(36).slice(2, 10)}`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      username,
      displayName: overrides.displayName ?? username,
      password: overrides.password ?? 'hunter22!',
    })
    .expect(201);
  return res.body.data as Session;
}

export function authed(app: Express, token: string) {
  return {
    get: (path: string) =>
      request(app).get(path).set('Authorization', `Bearer ${token}`),
    post: (path: string, body?: unknown) =>
      request(app).post(path).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    patch: (path: string, body?: unknown) =>
      request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    delete: (path: string) =>
      request(app).delete(path).set('Authorization', `Bearer ${token}`),
  };
}
