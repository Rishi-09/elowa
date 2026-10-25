import { authed, closeDb, getApp, register, resetDb, type Session } from './helpers';

beforeEach(resetDb);
afterAll(closeDb);

async function pair(): Promise<{ a: Session; b: Session; convId: string }> {
  const app = await getApp();
  const a = await register(app, { username: 'msga' });
  const b = await register(app, { username: 'msgb' });
  const conv = await authed(app, a.accessToken)
    .post('/api/conversations', { peerUserId: b.user.id })
    .expect(201);
  return { a, b, convId: conv.body.data.id };
}

describe('messages', () => {
  test('send + list for members', async () => {
    const app = await getApp();
    const { a, convId } = await pair();

    const sent = await authed(app, a.accessToken)
      .post('/api/messages', {
        conversationId: convId,
        clientMessageId: 'cm_test_111111',
        type: 'text',
        body: 'hello',
      })
      .expect(201);
    expect(sent.body.data.body).toBe('hello');

    const page = await authed(app, a.accessToken)
      .get(`/api/conversations/${convId}/messages?limit=10`)
      .expect(200);
    expect(page.body.data.items).toHaveLength(1);
  });

  test('clientMessageId retry is idempotent (no duplicates)', async () => {
    const app = await getApp();
    const { a, convId } = await pair();

    const payload = {
      conversationId: convId,
      clientMessageId: 'cm_dedupe_1',
      type: 'text',
      body: 'retry me',
    };
    const first = await authed(app, a.accessToken).post('/api/messages', payload).expect(201);
    const retry = await authed(app, a.accessToken).post('/api/messages', payload);
    // Retry MUST return the same persisted message, not create a new one.
    expect([200, 201]).toContain(retry.status);
    expect(retry.body.data.id).toBe(first.body.data.id);

    const page = await authed(app, a.accessToken)
      .get(`/api/conversations/${convId}/messages?limit=10`)
      .expect(200);
    expect(page.body.data.items).toHaveLength(1);
  });

  test('non-member cannot read or write to a conversation (IDOR)', async () => {
    const app = await getApp();
    const { convId } = await pair();
    const eve = await register(app, { username: 'eve' });

    const readRes = await authed(app, eve.accessToken).get(
      `/api/conversations/${convId}/messages?limit=10`,
    );
    expect([403, 404]).toContain(readRes.status);

    const writeRes = await authed(app, eve.accessToken).post('/api/messages', {
      conversationId: convId,
      clientMessageId: 'cm_eve_111111',
      type: 'text',
      body: 'intrusion',
    });
    expect(writeRes.status).toBe(403);
  });

  test('only sender can edit or delete their own message', async () => {
    const app = await getApp();
    const { a, b, convId } = await pair();
    const sent = await authed(app, a.accessToken)
      .post('/api/messages', {
        conversationId: convId,
        clientMessageId: 'cm_edit_1',
        type: 'text',
        body: 'mine',
      })
      .expect(201);

    const forbiddenEdit = await authed(app, b.accessToken).patch(
      `/api/messages/${sent.body.data.id}`,
      { body: 'tampered' },
    );
    expect(forbiddenEdit.status).toBe(403);

    const okEdit = await authed(app, a.accessToken)
      .patch(`/api/messages/${sent.body.data.id}`, { body: 'edited' })
      .expect(200);
    expect(okEdit.body.data.body).toBe('edited');
    expect(okEdit.body.data.editedAt).toBeTruthy();

    const forbiddenDel = await authed(app, b.accessToken).delete(
      `/api/messages/${sent.body.data.id}`,
    );
    expect(forbiddenDel.status).toBe(403);

    const okDel = await authed(app, a.accessToken)
      .delete(`/api/messages/${sent.body.data.id}`)
      .expect(200);
    expect(okDel.body.data.body).toBeNull();
    expect(okDel.body.data.deletedAt).toBeTruthy();
  });

  test('disappearing TTL assigns expiresAt on new messages', async () => {
    const app = await getApp();
    const { a, convId } = await pair();

    await authed(app, a.accessToken)
      .patch(`/api/conversations/${convId}`, { disappearingTtlSeconds: 60 })
      .expect(200);

    const sent = await authed(app, a.accessToken)
      .post('/api/messages', {
        conversationId: convId,
        clientMessageId: 'cm_ttl_1',
        type: 'text',
        body: 'ephemeral',
      })
      .expect(201);
    expect(sent.body.data.expiresAt).toBeTruthy();
    const diff = new Date(sent.body.data.expiresAt).getTime() - Date.now();
    expect(diff).toBeGreaterThan(50_000);
    expect(diff).toBeLessThan(70_000);
  });

  test('text message with empty body is rejected', async () => {
    const app = await getApp();
    const { a, convId } = await pair();
    const res = await authed(app, a.accessToken).post('/api/messages', {
      conversationId: convId,
      clientMessageId: 'cm_empty_1',
      type: 'text',
      body: '   ',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('empty_body');
  });

  test('message:send on non-existent conversation is rejected', async () => {
    const app = await getApp();
    const a = await register(app, { username: 'nocv1' });
    const res = await authed(app, a.accessToken).post('/api/messages', {
      conversationId: '507f1f77bcf86cd799439011',
      clientMessageId: 'cm_fake_111',
      type: 'text',
      body: 'nope',
    });
    expect(res.status).toBe(403);
  });
});
