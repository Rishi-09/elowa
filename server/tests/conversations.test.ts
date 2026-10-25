import { authed, closeDb, getApp, register, resetDb } from './helpers';

beforeEach(resetDb);
afterAll(closeDb);

describe('conversations', () => {
  test('create is idempotent for the same pair', async () => {
    const app = await getApp();
    const alice = await register(app, { username: 'conva' });
    const bob = await register(app, { username: 'convb' });

    const r1 = await authed(app, alice.accessToken)
      .post('/api/conversations', { peerUserId: bob.user.id })
      .expect(201);
    const r2 = await authed(app, alice.accessToken)
      .post('/api/conversations', { peerUserId: bob.user.id })
      .expect(200);
    expect(r1.body.data.id).toBe(r2.body.data.id);

    const r3 = await authed(app, bob.accessToken)
      .post('/api/conversations', { peerUserId: alice.user.id })
      .expect(200);
    expect(r3.body.data.id).toBe(r1.body.data.id);
  });

  test('cannot message yourself', async () => {
    const app = await getApp();
    const alice = await register(app, { username: 'solo' });
    const res = await authed(app, alice.accessToken).post('/api/conversations', {
      peerUserId: alice.user.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_peer');
  });

  test('listing excludes conversations the user is not in (IDOR)', async () => {
    const app = await getApp();
    const alice = await register(app, { username: 'idora' });
    const bob = await register(app, { username: 'idorb' });
    const eve = await register(app, { username: 'idore' });

    await authed(app, alice.accessToken).post('/api/conversations', {
      peerUserId: bob.user.id,
    });

    const evesList = await authed(app, eve.accessToken).get('/api/conversations').expect(200);
    expect(evesList.body.data).toHaveLength(0);

    const alicesList = await authed(app, alice.accessToken).get('/api/conversations').expect(200);
    expect(alicesList.body.data).toHaveLength(1);
  });

  test('non-member cannot patch disappearing TTL', async () => {
    const app = await getApp();
    const alice = await register(app, { username: 'ttla' });
    const bob = await register(app, { username: 'ttlb' });
    const eve = await register(app, { username: 'ttle' });

    const conv = await authed(app, alice.accessToken)
      .post('/api/conversations', { peerUserId: bob.user.id })
      .expect(201);

    const forbidden = await authed(app, eve.accessToken).patch(
      `/api/conversations/${conv.body.data.id}`,
      { disappearingTtlSeconds: 86400 },
    );
    expect(forbidden.status).toBe(404);
  });
});
