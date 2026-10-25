import request from 'supertest';
import { closeDb, getApp, register, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(closeDb);

describe('auth', () => {
  test('register returns a session + rejects duplicates', async () => {
    const app = await getApp();
    const first = await register(app, { username: 'alice' });
    expect(first.user.username).toBe('alice');
    expect(first.accessToken).toBeTruthy();
    expect(first.refreshToken).toBeTruthy();

    const dup = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', displayName: 'Alice 2', password: 'hunter22!' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('conflict');
  });

  test('login validates credentials and lowercases username', async () => {
    const app = await getApp();
    await register(app, { username: 'bob', password: 'topsecret1' });

    const okRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'BOB', password: 'topsecret1' });
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.user.username).toBe('bob');

    const badPw = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'wrong-password' });
    expect(badPw.status).toBe(400);
    expect(badPw.body.error.code).toBe('invalid_credentials');

    const missing = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nope', password: 'whatever' });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('invalid_credentials');
  });

  test('refresh rotates tokens and detects reuse', async () => {
    const app = await getApp();
    const s = await register(app, { username: 'carol' });

    const first = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: s.refreshToken })
      .expect(200);
    const newRefresh = first.body.data.refreshToken;
    expect(newRefresh).not.toBe(s.refreshToken);
    expect(first.body.data.accessToken).toBeTruthy();

    // Reusing the OLD refresh token should fail AND revoke the chain.
    const reuse = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: s.refreshToken });
    expect(reuse.status).toBe(401);

    const afterReuse = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: newRefresh });
    expect(afterReuse.status).toBe(401);
  });

  test('access token guards protected routes', async () => {
    const app = await getApp();
    const unauth = await request(app).get('/api/profile');
    expect(unauth.status).toBe(401);

    const s = await register(app, { username: 'dave' });
    const okRes = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${s.accessToken}`);
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.username).toBe('dave');
  });

  test('validation errors have the right code', async () => {
    const app = await getApp();
    const bad = await request(app)
      .post('/api/auth/register')
      .send({ username: 'ab', displayName: '', password: 'short' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('validation_error');
  });
});
