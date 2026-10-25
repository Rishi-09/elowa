import { Types } from 'mongoose';
import type { Express } from 'express';
import { getApp, resetDb, closeDb, register, authed, type Session } from './helpers';
import { messagesService } from '../src/modules/messages/messages.service';
import { Conversation } from '../src/models/Conversation';
import { Message } from '../src/models/Message';

let app: Express;

async function conversationWith(a: Session, b: Session): Promise<string> {
  const res = await authed(app, a.accessToken)
    .post('/api/conversations', { peerUserId: b.user.id })
    .expect(201);
  return res.body.data.id as string;
}

async function sendText(from: Session, conversationId: string, body: string, n: number) {
  const res = await authed(app, from.accessToken)
    .post('/api/messages', {
      conversationId,
      clientMessageId: `cm_${from.user.id}_${n}`,
      type: 'text',
      body,
    })
    .expect(201);
  return res.body.data as { id: string; status: string };
}

beforeAll(async () => {
  app = await getApp();
});

beforeEach(resetDb);

afterAll(closeDb);

describe('read receipts', () => {
  it('marks every earlier incoming message as read, not just the newest', async () => {
    const me = await register(app);
    const peer = await register(app);
    const conv = await conversationWith(me, peer);

    const first = await sendText(me, conv, 'one', 1);
    const second = await sendText(me, conv, 'two', 2);
    const third = await sendText(me, conv, 'three', 3);

    const result = await messagesService.markRead(
      new Types.ObjectId(peer.user.id),
      conv,
      third.id,
    );

    expect(result.ids).toHaveLength(3);
    expect(result.ids).toEqual(expect.arrayContaining([first.id, second.id, third.id]));
    expect(result.uptoCreatedAt).not.toBeNull();

    const statuses = await Message.find({ conversationId: conv }).select({ status: 1 }).lean();
    expect(statuses.every((m) => m.status === 'read')).toBe(true);
  });

  it('clears the reader unread counter and leaves the sender counter alone', async () => {
    const me = await register(app);
    const peer = await register(app);
    const conv = await conversationWith(me, peer);
    const msg = await sendText(me, conv, 'hello', 1);

    /* `lean()` returns the Mongo Map field as a plain object. */
    const unreadOf = async (): Promise<Record<string, number>> => {
      const doc = await Conversation.findById(conv).lean();
      return (doc!.unread ?? {}) as unknown as Record<string, number>;
    };

    expect((await unreadOf())[peer.user.id]).toBe(1);

    await messagesService.markRead(new Types.ObjectId(peer.user.id), conv, msg.id);

    const after = await unreadOf();
    expect(after[peer.user.id]).toBe(0);
    expect(after[me.user.id] ?? 0).toBe(0);
  });

  it('is idempotent: a repeat read reports no newly changed messages', async () => {
    const me = await register(app);
    const peer = await register(app);
    const conv = await conversationWith(me, peer);
    const msg = await sendText(me, conv, 'hello', 1);
    const reader = new Types.ObjectId(peer.user.id);

    expect((await messagesService.markRead(reader, conv, msg.id)).ids).toHaveLength(1);
    expect((await messagesService.markRead(reader, conv, msg.id)).ids).toHaveLength(0);
  });

  it('refuses to mark read in a conversation the caller does not belong to', async () => {
    const me = await register(app);
    const peer = await register(app);
    const outsider = await register(app);
    const conv = await conversationWith(me, peer);
    const msg = await sendText(me, conv, 'private', 1);

    await expect(
      messagesService.markRead(new Types.ObjectId(outsider.user.id), conv, msg.id),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('ignores a watermark message from a different conversation', async () => {
    const me = await register(app);
    const peer = await register(app);
    const other = await register(app);
    const convA = await conversationWith(me, peer);
    const convB = await conversationWith(me, other);

    await sendText(me, convA, 'in A', 1);
    const inB = await sendText(me, convB, 'in B', 2);

    const result = await messagesService.markRead(
      new Types.ObjectId(peer.user.id),
      convA,
      inB.id,
    );
    expect(result.ids).toHaveLength(0);
  });
});

describe('delivery receipts', () => {
  it('flushes everything a participant missed while offline', async () => {
    const me = await register(app);
    const peer = await register(app);
    const conv = await conversationWith(me, peer);

    await sendText(me, conv, 'one', 1);
    await sendText(me, conv, 'two', 2);

    const ids = await messagesService.markDeliveredFor(conv, new Types.ObjectId(peer.user.id));
    expect(ids).toHaveLength(2);

    const again = await messagesService.markDeliveredFor(conv, new Types.ObjectId(peer.user.id));
    expect(again).toHaveLength(0);
  });

  it('never marks the sender own messages as delivered to themselves', async () => {
    const me = await register(app);
    const peer = await register(app);
    const conv = await conversationWith(me, peer);
    await sendText(me, conv, 'mine', 1);

    const ids = await messagesService.markDeliveredFor(conv, new Types.ObjectId(me.user.id));
    expect(ids).toHaveLength(0);
  });
});

describe('reactions', () => {
  it('adds, replaces and removes the caller reaction', async () => {
    const me = await register(app);
    const peer = await register(app);
    const conv = await conversationWith(me, peer);
    const msg = await sendText(me, conv, 'react to me', 1);

    const added = await authed(app, peer.accessToken)
      .post(`/api/messages/${msg.id}/reactions`, { emoji: '❤️' })
      .expect(200);
    expect(added.body.data.reactions).toHaveLength(1);
    expect(added.body.data.reactions[0]).toMatchObject({
      userId: peer.user.id,
      emoji: '❤️',
    });

    const replaced = await authed(app, peer.accessToken)
      .post(`/api/messages/${msg.id}/reactions`, { emoji: '👍' })
      .expect(200);
    expect(replaced.body.data.reactions).toHaveLength(1);
    expect(replaced.body.data.reactions[0].emoji).toBe('👍');

    const removed = await authed(app, peer.accessToken)
      .post(`/api/messages/${msg.id}/reactions`, { emoji: '👍' })
      .expect(200);
    expect(removed.body.data.reactions).toHaveLength(0);
  });

  it('keeps reactions from different users side by side', async () => {
    const me = await register(app);
    const peer = await register(app);
    const conv = await conversationWith(me, peer);
    const msg = await sendText(me, conv, 'two reactions', 1);

    await authed(app, me.accessToken)
      .post(`/api/messages/${msg.id}/reactions`, { emoji: '❤️' })
      .expect(200);
    const res = await authed(app, peer.accessToken)
      .post(`/api/messages/${msg.id}/reactions`, { emoji: '👍' })
      .expect(200);

    expect(res.body.data.reactions).toHaveLength(2);
  });

  it('refuses a reaction from a non-participant', async () => {
    const me = await register(app);
    const peer = await register(app);
    const outsider = await register(app);
    const conv = await conversationWith(me, peer);
    const msg = await sendText(me, conv, 'private', 1);

    await authed(app, outsider.accessToken)
      .post(`/api/messages/${msg.id}/reactions`, { emoji: '❤️' })
      .expect(403);
  });

  it('rejects an over-long reaction payload', async () => {
    const me = await register(app);
    const peer = await register(app);
    const conv = await conversationWith(me, peer);
    const msg = await sendText(me, conv, 'hi', 1);

    await authed(app, me.accessToken)
      .post(`/api/messages/${msg.id}/reactions`, { emoji: 'x'.repeat(40) })
      .expect(400);
  });
});

describe('in-conversation search', () => {
  it('finds matching text and ignores other conversations', async () => {
    const me = await register(app);
    const peer = await register(app);
    const other = await register(app);
    const convA = await conversationWith(me, peer);
    const convB = await conversationWith(me, other);

    await sendText(me, convA, 'dinner at eight', 1);
    await sendText(me, convA, 'unrelated chatter', 2);
    await sendText(me, convB, 'dinner somewhere else', 3);

    const res = await authed(app, me.accessToken)
      .get(`/api/conversations/${convA}/messages/search?q=dinner`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].body).toBe('dinner at eight');
  });

  it('excludes deleted messages from results', async () => {
    const me = await register(app);
    const peer = await register(app);
    const conv = await conversationWith(me, peer);
    const msg = await sendText(me, conv, 'forgettable', 1);

    await authed(app, me.accessToken).delete(`/api/messages/${msg.id}`).expect(200);

    const res = await authed(app, me.accessToken)
      .get(`/api/conversations/${conv}/messages/search?q=forgettable`)
      .expect(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('refuses to search a conversation the caller does not belong to', async () => {
    const me = await register(app);
    const peer = await register(app);
    const outsider = await register(app);
    const conv = await conversationWith(me, peer);
    await sendText(me, conv, 'secret plans', 1);

    await authed(app, outsider.accessToken)
      .get(`/api/conversations/${conv}/messages/search?q=secret`)
      .expect(403);
  });

  it('rejects a query that is too short to be useful', async () => {
    const me = await register(app);
    const peer = await register(app);
    const conv = await conversationWith(me, peer);

    await authed(app, me.accessToken)
      .get(`/api/conversations/${conv}/messages/search?q=a`)
      .expect(400);
  });
});
