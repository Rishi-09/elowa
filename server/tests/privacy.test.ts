import type { Express } from 'express';
import { getApp, resetDb, closeDb, register, authed, type Session } from './helpers';
import { User } from '../src/models/User';

let app: Express;

const goOnline = (session: Session) =>
  User.updateOne(
    { _id: session.user.id },
    { $set: { isOnline: true, lastSeenAt: new Date() } },
  );

async function directConversation(a: Session, b: Session): Promise<string> {
  const res = await authed(app, a.accessToken)
    .post('/api/conversations', { peerUserId: b.user.id })
    .expect(201);
  return res.body.data.id as string;
}

beforeAll(async () => {
  app = await getApp();
});

beforeEach(resetDb);

afterAll(closeDb);

describe('privacy defaults', () => {
  it('starts every account fully discoverable with presence shared', async () => {
    const me = await register(app);
    const res = await authed(app, me.accessToken).get('/api/profile/privacy').expect(200);
    expect(res.body.data).toEqual({
      showPresence: true,
      showReadReceipts: true,
      searchable: true,
    });
  });

  it('returns the caller own presence and privacy block on their profile', async () => {
    const me = await register(app);
    await goOnline(me);
    const res = await authed(app, me.accessToken).get('/api/profile').expect(200);
    expect(res.body.data.isOnline).toBe(true);
    expect(res.body.data.privacy.showPresence).toBe(true);
  });
});

describe('presence privacy', () => {
  it('shares presence with a conversation partner by default', async () => {
    const me = await register(app);
    const peer = await register(app);
    await directConversation(me, peer);
    await goOnline(peer);

    const res = await authed(app, me.accessToken).get(`/api/users/${peer.user.id}`).expect(200);
    expect(res.body.data.isOnline).toBe(true);
  });

  it('hides presence from partners once the user turns it off', async () => {
    const me = await register(app);
    const peer = await register(app);
    await directConversation(me, peer);
    await goOnline(peer);

    await authed(app, peer.accessToken)
      .patch('/api/profile/privacy', { showPresence: false })
      .expect(200);

    const res = await authed(app, me.accessToken).get(`/api/users/${peer.user.id}`).expect(200);
    expect(res.body.data.isOnline).toBe(false);
    expect(res.body.data.lastSeenAt).toBeNull();
  });

  it('marks the user offline straight away when presence is switched off', async () => {
    const me = await register(app);
    await goOnline(me);

    await authed(app, me.accessToken)
      .patch('/api/profile/privacy', { showPresence: false })
      .expect(200);

    const stored = await User.findById(me.user.id).lean();
    expect(stored!.isOnline).toBe(false);
  });

  it('keeps presence out of the conversation list for an opted-out peer', async () => {
    const me = await register(app);
    const peer = await register(app);
    await directConversation(me, peer);
    await goOnline(peer);
    await authed(app, peer.accessToken)
      .patch('/api/profile/privacy', { showPresence: false })
      .expect(200);

    const list = await authed(app, me.accessToken).get('/api/conversations').expect(200);
    expect(list.body.data[0].peer.isOnline).toBe(false);
  });

  it('never exposes presence to a stranger, even with presence enabled', async () => {
    const me = await register(app);
    const stranger = await register(app, { username: 'findable_user' });
    await goOnline(stranger);

    const res = await authed(app, me.accessToken)
      .get(`/api/users/${stranger.user.id}`)
      .expect(200);
    expect(res.body.data.isOnline).toBeUndefined();
    expect(res.body.data.lastSeenAt).toBeUndefined();
  });
});

describe('discoverability', () => {
  it('finds a searchable user by username prefix', async () => {
    const me = await register(app);
    await register(app, { username: 'discoverable' });

    const res = await authed(app, me.accessToken)
      .get('/api/users/search?q=discover')
      .expect(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('omits a user who turned discovery off', async () => {
    const me = await register(app);
    const hidden = await register(app, { username: 'hiddenperson' });

    await authed(app, hidden.accessToken)
      .patch('/api/profile/privacy', { searchable: false })
      .expect(200);

    const res = await authed(app, me.accessToken).get('/api/users/search?q=hidden').expect(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('refuses a direct profile lookup of a non-discoverable stranger', async () => {
    const me = await register(app);
    const hidden = await register(app, { username: 'hiddenperson2' });
    await authed(app, hidden.accessToken)
      .patch('/api/profile/privacy', { searchable: false })
      .expect(200);

    await authed(app, me.accessToken).get(`/api/users/${hidden.user.id}`).expect(404);
  });

  it('still shows a non-discoverable user to an existing conversation partner', async () => {
    const me = await register(app);
    const peer = await register(app, { username: 'hiddenpartner' });
    await directConversation(me, peer);

    await authed(app, peer.accessToken)
      .patch('/api/profile/privacy', { searchable: false })
      .expect(200);

    const res = await authed(app, me.accessToken).get(`/api/users/${peer.user.id}`).expect(200);
    expect(res.body.data.username).toBe('hiddenpartner');
  });
});

describe('profile editing', () => {
  it('updates display name and bio', async () => {
    const me = await register(app);
    const res = await authed(app, me.accessToken)
      .patch('/api/profile', { displayName: 'Rishi K', bio: 'Building Elowa' })
      .expect(200);
    expect(res.body.data.displayName).toBe('Rishi K');
    expect(res.body.data.bio).toBe('Building Elowa');
  });

  it('refuses to write fields that are not part of the profile contract', async () => {
    const me = await register(app);
    await authed(app, me.accessToken)
      .patch('/api/profile', { username: 'someoneelse', displayName: 'Fine' })
      .expect(400);

    const stored = await User.findById(me.user.id).lean();
    expect(stored!.username).toBe(me.user.username);
  });

  it('rejects an over-long bio', async () => {
    const me = await register(app);
    await authed(app, me.accessToken)
      .patch('/api/profile', { bio: 'x'.repeat(400) })
      .expect(400);
  });

  it('rejects an avatar value that is not a URL', async () => {
    const me = await register(app);
    await authed(app, me.accessToken)
      .patch('/api/profile', { avatarUrl: 'javascript:alert(1)' })
      .expect(400);
  });

  it('requires a session', async () => {
    await register(app);
    const res = await authed(app, 'not-a-token').patch('/api/profile', { displayName: 'x' });
    expect(res.status).toBe(401);
  });
});
