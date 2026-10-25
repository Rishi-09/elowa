import type { Express } from 'express';
import { getApp, resetDb, closeDb, register, authed, type Session } from './helpers';

let app: Express;

async function makeGroup(owner: Session, members: Session[], title = 'Weekend plans') {
  const res = await authed(app, owner.accessToken)
    .post('/api/conversations/group', {
      title,
      memberIds: members.map((m) => m.user.id),
    })
    .expect(201);
  return res.body.data as {
    id: string;
    type: string;
    title: string;
    adminIds: string[];
    participantIds: string[];
    members: { id: string }[];
  };
}

beforeAll(async () => {
  app = await getApp();
});

beforeEach(resetDb);

afterAll(closeDb);

describe('group creation', () => {
  it('creates a group with the caller as the only admin', async () => {
    const me = await register(app);
    const a = await register(app);
    const b = await register(app);

    const group = await makeGroup(me, [a, b]);

    expect(group.type).toBe('group');
    expect(group.title).toBe('Weekend plans');
    expect(group.adminIds).toEqual([me.user.id]);
    expect(group.participantIds).toHaveLength(3);
    expect(group.members).toHaveLength(3);
  });

  it('rejects a group with no other members', async () => {
    const me = await register(app);
    await authed(app, me.accessToken)
      .post('/api/conversations/group', { title: 'Just me', memberIds: [] })
      .expect(400);
  });

  it('rejects an unknown member id', async () => {
    const me = await register(app);
    const res = await authed(app, me.accessToken)
      .post('/api/conversations/group', {
        title: 'Ghosts',
        memberIds: ['65b0000000000000000000aa'],
      })
      .expect(400);
    expect(res.body.error.code).toBe('unknown_member');
  });

  it('rejects an empty title', async () => {
    const me = await register(app);
    const a = await register(app);
    await authed(app, me.accessToken)
      .post('/api/conversations/group', { title: '   ', memberIds: [a.user.id] })
      .expect(400);
  });

  it('lists the group for every member and nobody else', async () => {
    const me = await register(app);
    const a = await register(app);
    const outsider = await register(app);
    const group = await makeGroup(me, [a]);

    for (const session of [me, a]) {
      const list = await authed(app, session.accessToken).get('/api/conversations').expect(200);
      expect(list.body.data.map((c: { id: string }) => c.id)).toContain(group.id);
    }

    const theirs = await authed(app, outsider.accessToken)
      .get('/api/conversations')
      .expect(200);
    expect(theirs.body.data).toHaveLength(0);
  });

  it('hides a group from a non-member asking for it directly', async () => {
    const me = await register(app);
    const a = await register(app);
    const outsider = await register(app);
    const group = await makeGroup(me, [a]);

    await authed(app, outsider.accessToken).get(`/api/conversations/${group.id}`).expect(404);
  });
});

describe('group permissions', () => {
  it('lets an admin rename the group', async () => {
    const me = await register(app);
    const a = await register(app);
    const group = await makeGroup(me, [a]);

    const res = await authed(app, me.accessToken)
      .patch(`/api/conversations/${group.id}`, { title: 'Renamed' })
      .expect(200);
    expect(res.body.data.title).toBe('Renamed');
  });

  it('refuses a rename from a non-admin member', async () => {
    const me = await register(app);
    const a = await register(app);
    const group = await makeGroup(me, [a]);

    const res = await authed(app, a.accessToken)
      .patch(`/api/conversations/${group.id}`, { title: 'Hostile takeover' })
      .expect(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('refuses a rename from someone outside the group', async () => {
    const me = await register(app);
    const a = await register(app);
    const outsider = await register(app);
    const group = await makeGroup(me, [a]);

    await authed(app, outsider.accessToken)
      .patch(`/api/conversations/${group.id}`, { title: 'Nope' })
      .expect(404);
  });

  it('lets an admin add and remove members', async () => {
    const me = await register(app);
    const a = await register(app);
    const b = await register(app);
    const group = await makeGroup(me, [a]);

    const added = await authed(app, me.accessToken)
      .post(`/api/conversations/${group.id}/members`, { userIds: [b.user.id] })
      .expect(200);
    expect(added.body.data.participantIds).toHaveLength(3);

    const removed = await authed(app, me.accessToken)
      .delete(`/api/conversations/${group.id}/members/${b.user.id}`)
      .expect(200);
    expect(removed.body.data.participantIds).toHaveLength(2);
    expect(removed.body.data.participantIds).not.toContain(b.user.id);
  });

  it('refuses member changes from a non-admin', async () => {
    const me = await register(app);
    const a = await register(app);
    const b = await register(app);
    const group = await makeGroup(me, [a]);

    await authed(app, a.accessToken)
      .post(`/api/conversations/${group.id}/members`, { userIds: [b.user.id] })
      .expect(403);
  });

  it('will not shrink a group below two members', async () => {
    const me = await register(app);
    const a = await register(app);
    const group = await makeGroup(me, [a]);

    const res = await authed(app, me.accessToken)
      .delete(`/api/conversations/${group.id}/members/${a.user.id}`)
      .expect(400);
    expect(res.body.error.code).toBe('too_few_members');
  });

  it('promotes and demotes admins, but keeps at least one', async () => {
    const me = await register(app);
    const a = await register(app);
    const b = await register(app);
    const group = await makeGroup(me, [a, b]);

    const promoted = await authed(app, me.accessToken)
      .patch(`/api/conversations/${group.id}/members/${a.user.id}/admin`, { admin: true })
      .expect(200);
    expect(promoted.body.data.adminIds).toEqual(expect.arrayContaining([me.user.id, a.user.id]));

    const demoted = await authed(app, a.accessToken)
      .patch(`/api/conversations/${group.id}/members/${me.user.id}/admin`, { admin: false })
      .expect(200);
    expect(demoted.body.data.adminIds).toEqual([a.user.id]);

    const last = await authed(app, a.accessToken)
      .patch(`/api/conversations/${group.id}/members/${a.user.id}/admin`, { admin: false })
      .expect(400);
    expect(last.body.error.code).toBe('last_admin');
  });

  it('hands the admin role on when the last admin leaves', async () => {
    const me = await register(app);
    const a = await register(app);
    const b = await register(app);
    const group = await makeGroup(me, [a, b]);

    await authed(app, me.accessToken).post(`/api/conversations/${group.id}/leave`).expect(200);

    const after = await authed(app, a.accessToken)
      .get(`/api/conversations/${group.id}`)
      .expect(200);
    expect(after.body.data.participantIds).toHaveLength(2);
    expect(after.body.data.adminIds).toHaveLength(1);
    expect(after.body.data.adminIds).not.toContain(me.user.id);

    await authed(app, me.accessToken).get(`/api/conversations/${group.id}`).expect(404);
  });

  it('refuses to leave when it would leave fewer than two members', async () => {
    const me = await register(app);
    const a = await register(app);
    const group = await makeGroup(me, [a]);

    await authed(app, me.accessToken).post(`/api/conversations/${group.id}/leave`).expect(400);
  });
});

describe('group messaging', () => {
  const send = (from: Session, conversationId: string, body: string, n: number) =>
    authed(app, from.accessToken)
      .post('/api/messages', {
        conversationId,
        clientMessageId: `cm_${from.user.id}_${n}`,
        type: 'text',
        body,
      })
      .expect(201);

  it('raises the unread counter for every recipient, not just one', async () => {
    const me = await register(app);
    const a = await register(app);
    const b = await register(app);
    const group = await makeGroup(me, [a, b]);

    await send(me, group.id, 'hello all', 1);

    for (const session of [a, b]) {
      const list = await authed(app, session.accessToken).get('/api/conversations').expect(200);
      const row = list.body.data.find((c: { id: string }) => c.id === group.id);
      expect(row.unreadCount).toBe(1);
    }

    const mine = await authed(app, me.accessToken).get('/api/conversations').expect(200);
    expect(mine.body.data.find((c: { id: string }) => c.id === group.id).unreadCount).toBe(0);
  });

  it('refuses messages from a user who was removed', async () => {
    const me = await register(app);
    const a = await register(app);
    const b = await register(app);
    const group = await makeGroup(me, [a, b]);

    await send(a, group.id, 'still here', 1);
    await authed(app, me.accessToken)
      .delete(`/api/conversations/${group.id}/members/${a.user.id}`)
      .expect(200);

    await authed(app, a.accessToken)
      .post('/api/messages', {
        conversationId: group.id,
        clientMessageId: 'cm_after_removal',
        type: 'text',
        body: 'let me back in',
      })
      .expect(403);
  });

  it('refuses messages from a user who never joined', async () => {
    const me = await register(app);
    const a = await register(app);
    const outsider = await register(app);
    const group = await makeGroup(me, [a]);

    await authed(app, outsider.accessToken)
      .post('/api/messages', {
        conversationId: group.id,
        clientMessageId: 'cm_outsider',
        type: 'text',
        body: 'hi',
      })
      .expect(403);
  });

  it('stops serving history to a removed member', async () => {
    const me = await register(app);
    const a = await register(app);
    const b = await register(app);
    const group = await makeGroup(me, [a, b]);
    await send(me, group.id, 'group secret', 1);

    await authed(app, a.accessToken)
      .get(`/api/conversations/${group.id}/messages`)
      .expect(200);

    await authed(app, me.accessToken)
      .delete(`/api/conversations/${group.id}/members/${a.user.id}`)
      .expect(200);

    await authed(app, a.accessToken)
      .get(`/api/conversations/${group.id}/messages`)
      .expect(403);
  });
});
