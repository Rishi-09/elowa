import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import type { Express } from 'express';
import { getApp, resetDb, closeDb, register, authed } from './helpers';
import { Message } from '../src/models/Message';

let app: Express;

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001',
  'hex',
);

const stripHost = (url: string): string => url.replace('http://127.0.0.1:4000', '');

async function signAndUpload(token: string, body = PNG, mime = 'image/png') {
  const signed = await authed(app, token).post('/api/media/sign', { kind: 'image' }).expect(200);
  const { uploadUrl, publicIdPrefix } = signed.body.data;
  const upload = await request(app)
    .put(stripHost(uploadUrl))
    .set('Content-Type', mime)
    .send(body);
  return { publicId: publicIdPrefix as string, signed: signed.body.data, upload };
}

beforeAll(async () => {
  app = await getApp();
});

beforeEach(resetDb);

afterAll(async () => {
  await closeDb();
  await fs.rm(path.resolve(process.cwd(), process.env.MEDIA_LOCAL_DIR!), {
    recursive: true,
    force: true,
  });
});

describe('media upload', () => {
  it('signs a raw upload ticket scoped to the caller', async () => {
    const me = await register(app);
    const res = await authed(app, me.accessToken)
      .post('/api/media/sign', { kind: 'image' })
      .expect(200);

    expect(res.body.data.provider).toBe('local');
    expect(res.body.data.transport).toBe('raw');
    expect(res.body.data.publicIdPrefix).toMatch(new RegExp(`^u_${me.user.id}/image/`));
    expect(res.body.data.maxBytes).toBe(4096);
  });

  it('stores bytes and confirms a usable media ref', async () => {
    const me = await register(app);
    const { publicId, upload } = await signAndUpload(me.accessToken);
    expect(upload.status).toBe(201);

    const confirmed = await authed(app, me.accessToken)
      .post('/api/media/confirm', { publicId, kind: 'image', mime: 'image/png' })
      .expect(200);

    expect(confirmed.body.data.url).toBe(`http://127.0.0.1:4000/api/media/file/${publicId}`);
    expect(confirmed.body.data.size).toBe(PNG.length);
  });

  it('rejects an upload whose content type is not allowed', async () => {
    const me = await register(app);
    const { upload } = await signAndUpload(me.accessToken, PNG, 'application/x-msdownload');
    expect(upload.status).toBe(400);
    expect(upload.body.error.code).toBe('bad_mime');
  });

  it('rejects an upload larger than the server-side cap', async () => {
    const me = await register(app);
    const { upload } = await signAndUpload(me.accessToken, Buffer.alloc(5000, 1), 'image/png');
    expect(upload.status).toBe(400);
    expect(upload.body.error.code).toBe('too_large');
  });

  it('rejects an upload without a ticket', async () => {
    await register(app);
    const res = await request(app)
      .put('/api/media/upload')
      .set('Content-Type', 'image/png')
      .send(PNG);
    expect(res.status).toBe(401);
  });

  it('refuses to confirm an object key belonging to another user', async () => {
    const me = await register(app);
    const other = await register(app);
    const { publicId } = await signAndUpload(other.accessToken);

    const res = await authed(app, me.accessToken)
      .post('/api/media/confirm', { publicId, kind: 'image', mime: 'image/png' })
      .expect(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('refuses object keys that try to escape the storage root', async () => {
    const me = await register(app);

    /* Passes the ownership prefix check, so this exercises the path guard. */
    const res = await authed(app, me.accessToken)
      .post('/api/media/confirm', {
        publicId: `u_${me.user.id}/image/../../../etc/passwd`,
        kind: 'image',
        mime: 'image/png',
      })
      .expect(400);
    expect(res.body.error.code).toBe('bad_public_id');
  });

  it('refuses a key outside the caller prefix before touching disk', async () => {
    const me = await register(app);
    const res = await authed(app, me.accessToken)
      .post('/api/media/confirm', { publicId: '../../etc/passwd', kind: 'image', mime: 'image/png' })
      .expect(403);
    expect(res.body.error.code).toBe('forbidden');
  });
});

describe('media access control', () => {
  it('serves the owner their own object', async () => {
    const me = await register(app);
    const { publicId } = await signAndUpload(me.accessToken);

    const res = await authed(app, me.accessToken).get(`/api/media/file/${publicId}`).expect(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.body.length).toBe(PNG.length);
  });

  it('hides an unattached object from everyone else', async () => {
    const me = await register(app);
    const stranger = await register(app);
    const { publicId } = await signAndUpload(me.accessToken);

    await authed(app, stranger.accessToken).get(`/api/media/file/${publicId}`).expect(404);
  });

  it('serves it to a conversation participant once a message carries it', async () => {
    const me = await register(app);
    const peer = await register(app);
    const { publicId } = await signAndUpload(me.accessToken);

    const ref = await authed(app, me.accessToken)
      .post('/api/media/confirm', { publicId, kind: 'image', mime: 'image/png' })
      .expect(200);

    const conv = await authed(app, me.accessToken)
      .post('/api/conversations', { peerUserId: peer.user.id })
      .expect(201);

    await authed(app, me.accessToken)
      .post('/api/messages', {
        conversationId: conv.body.data.id,
        clientMessageId: 'cm_media_0001',
        type: 'image',
        media: ref.body.data,
      })
      .expect(201);

    await authed(app, peer.accessToken).get(`/api/media/file/${publicId}`).expect(200);
  });

  it('still hides it from a non-participant after it is attached', async () => {
    const me = await register(app);
    const peer = await register(app);
    const outsider = await register(app);
    const { publicId } = await signAndUpload(me.accessToken);

    const ref = await authed(app, me.accessToken)
      .post('/api/media/confirm', { publicId, kind: 'image', mime: 'image/png' })
      .expect(200);
    const conv = await authed(app, me.accessToken)
      .post('/api/conversations', { peerUserId: peer.user.id })
      .expect(201);
    await authed(app, me.accessToken)
      .post('/api/messages', {
        conversationId: conv.body.data.id,
        clientMessageId: 'cm_media_0002',
        type: 'image',
        media: ref.body.data,
      })
      .expect(201);

    await authed(app, outsider.accessToken).get(`/api/media/file/${publicId}`).expect(403);
  });

  it('stops serving media once its message is deleted', async () => {
    const me = await register(app);
    const peer = await register(app);
    const { publicId } = await signAndUpload(me.accessToken);

    const ref = await authed(app, me.accessToken)
      .post('/api/media/confirm', { publicId, kind: 'image', mime: 'image/png' })
      .expect(200);
    const conv = await authed(app, me.accessToken)
      .post('/api/conversations', { peerUserId: peer.user.id })
      .expect(201);
    const msg = await authed(app, me.accessToken)
      .post('/api/messages', {
        conversationId: conv.body.data.id,
        clientMessageId: 'cm_media_0003',
        type: 'image',
        media: ref.body.data,
      })
      .expect(201);

    await authed(app, me.accessToken).delete(`/api/messages/${msg.body.data.id}`).expect(200);
    expect(await Message.findById(msg.body.data.id).lean()).toMatchObject({ media: null });

    await authed(app, peer.accessToken).get(`/api/media/file/${publicId}`).expect(404);
  });

  it('requires a session to read media at all', async () => {
    const me = await register(app);
    const { publicId } = await signAndUpload(me.accessToken);
    await request(app).get(`/api/media/file/${publicId}`).expect(401);
  });
});
