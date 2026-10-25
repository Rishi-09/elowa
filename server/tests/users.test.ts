import { authed, closeDb, getApp, register, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(closeDb);

describe('users (privacy hardening)', () => {
  test('search never exposes presence fields', async () => {
    const app = await getApp();
    const alice = await register(app, { username: 'srcha' });
    await register(app, { username: 'srchb' });

    const res = await authed(app, alice.accessToken).get('/api/users/search?q=srch').expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const u of res.body.data) {
      expect(u).not.toHaveProperty('isOnline');
      expect(u).not.toHaveProperty('lastSeenAt');
    }
  });

  test('GET /users/:id hides presence from strangers, reveals it after a shared conversation', async () => {
    const app = await getApp();
    const alice = await register(app, { username: 'presa' });
    const bob = await register(app, { username: 'presb' });

    const stranger = await authed(app, alice.accessToken)
      .get(`/api/users/${bob.user.id}`)
      .expect(200);
    expect(stranger.body.data).not.toHaveProperty('isOnline');
    expect(stranger.body.data).not.toHaveProperty('lastSeenAt');

    await authed(app, alice.accessToken)
      .post('/api/conversations', { peerUserId: bob.user.id })
      .expect(201);

    const member = await authed(app, alice.accessToken)
      .get(`/api/users/${bob.user.id}`)
      .expect(200);
    expect(member.body.data).toHaveProperty('isOnline');
    expect(member.body.data).toHaveProperty('lastSeenAt');
  });

  test('search sanitizes regex metacharacters', async () => {
    const app = await getApp();
    const alice = await register(app, { username: 'regexer' });
    const res = await authed(app, alice.accessToken)
      .get(`/api/users/search?q=${encodeURIComponent('.*')}`)
      .expect(200);
    expect(res.body.data).toEqual([]);
  });
});
