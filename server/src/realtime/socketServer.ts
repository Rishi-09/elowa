import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { authSocket } from './authSocket';
import { presence } from './presence';
import { Conversation } from '../models/Conversation';
import { messagesService } from '../modules/messages/messages.service';
import { pushDispatcher } from '../modules/notifications/pushDispatcher';
import { User, privacyOf } from '../models/User';
import { AppError } from '../lib/errors';

const convRoom = (id: string) => `conv:${id}`;
const userRoom = (id: string) => `user:${id}`;

async function assertMember(conversationId: string, userId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(conversationId)) return false;
  const exists = await Conversation.exists({
    _id: new Types.ObjectId(conversationId),
    participantIds: new Types.ObjectId(userId),
  });
  return !!exists;
}

/**
 * Everyone who shares a conversation with this user. Presence is sent only to
 * them, rather than broadcast to every connected socket: a stranger must not
 * learn when an account comes online.
 */
async function contactRoomsOf(userId: string): Promise<string[]> {
  const me = new Types.ObjectId(userId);
  const convs = await Conversation.find({ participantIds: me })
    .select({ participantIds: 1 })
    .lean();

  const contacts = new Set<string>();
  for (const conv of convs) {
    for (const participant of conv.participantIds) {
      const id = String(participant);
      if (id !== userId) contacts.add(id);
    }
  }
  return Array.from(contacts, userRoom);
}

/** Broadcast a presence change to this user's contacts, if they allow it. */
async function emitPresence(
  io: Server,
  userId: string,
  isOnline: boolean,
  lastSeenAt: Date | null,
): Promise<void> {
  const user = await User.findById(userId).select({ privacy: 1 }).lean();
  if (!user || !privacyOf(user).showPresence) return;

  const rooms = await contactRoomsOf(userId);
  if (!rooms.length) return;

  io.to(rooms).emit('presence:update', {
    userId,
    isOnline,
    lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
  });
}

function failAck(e: unknown) {
  if (e instanceof AppError) return { ok: false as const, code: e.code, message: e.message };
  return { ok: false as const, code: 'internal_error', message: 'Something went wrong' };
}

export function attachSocketServer(http: HttpServer): Server {
  const io = new Server(http, {
    cors: { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') },
    transports: ['websocket', 'polling'],
    pingInterval: 25_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 15e6, // 15 MB — allows base64 image payloads up to ~11 MB raw
  });

  io.use(authSocket);

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(userRoom(userId));

    presence
      .onConnect(userId)
      .then(async (transitioned) => {
        if (transitioned) await emitPresence(io, userId, true, new Date());
      })
      .catch((err) => logger.error({ err }, 'presence connect failed'));

    socket.on('conversation:join', async ({ conversationId }, cb) => {
      try {
        if (!(await assertMember(conversationId, userId))) {
          cb?.({ ok: false, code: 'forbidden', message: 'Not a member' });
          return;
        }
        socket.join(convRoom(conversationId));
        cb?.({ ok: true });

        /* Catch up on delivery receipts for messages that landed while this
           participant was away, so senders stop showing a single tick. */
        const me = new Types.ObjectId(userId);
        const delivered = await messagesService.markDeliveredFor(conversationId, me);
        if (delivered.length) {
          io.to(convRoom(conversationId)).emit('message:status', {
            ids: delivered,
            status: 'delivered',
            at: new Date().toISOString(),
          });
        }
      } catch (e) {
        cb?.(failAck(e));
      }
    });

    socket.on('conversation:leave', ({ conversationId }) => {
      socket.leave(convRoom(conversationId));
    });

    socket.on('message:send', async (payload, cb) => {
      try {
        const msg = await messagesService.send(new Types.ObjectId(userId), payload);
        io.to(convRoom(payload.conversationId)).emit('message:new', msg);
        cb({ ok: true, message: msg });

        void (async () => {
          try {
            const activeInConv = await io.in(convRoom(payload.conversationId)).fetchSockets();
            const otherPresent = activeInConv.some((s) => s.data.userId !== userId);
            if (otherPresent) {
              const deliveredAt = new Date();
              await messagesService.markDelivered((msg as { id: string }).id, deliveredAt);
              io.to(convRoom(payload.conversationId)).emit('message:status', {
                ids: [(msg as { id: string }).id],
                status: 'delivered',
                at: deliveredAt.toISOString(),
              });
            }
          } catch (err) {
            logger.warn({ err }, 'delivered receipt failed');
          }
        })();

        void (async () => {
          try {
            const conv = await Conversation.findById(payload.conversationId).lean();
            if (!conv) return;

            const sender = await User.findById(userId).lean();
            if (!sender) return;

            /* Recipients come from the database, never from the client
               payload, and anyone already watching the room is skipped. */
            const activeInConv = await io.in(convRoom(payload.conversationId)).fetchSockets();
            const watching = new Set(activeInConv.map((s) => String(s.data.userId)));

            const recipients = conv.participantIds
              .map(String)
              .filter((id) => id !== userId && !watching.has(id));

            const senderLabel =
              conv.type === 'group' && conv.title
                ? `${sender.displayName} in ${conv.title}`
                : sender.displayName;

            await Promise.all(
              recipients.map((recipientUserId) =>
                pushDispatcher.send({
                  recipientUserId,
                  conversationId: payload.conversationId,
                  senderDisplayName: senderLabel,
                  messageType: payload.type,
                  bodyPreview: payload.body ?? null,
                }),
              ),
            );
          } catch (err) {
            logger.warn({ err }, 'push side-effect failed');
          }
        })();
      } catch (e) {
        cb(failAck(e) as never);
      }
    });

    socket.on('message:edit', async ({ messageId, body }, cb) => {
      try {
        const msg = await messagesService.edit(new Types.ObjectId(userId), messageId, body);
        io.to(convRoom((msg as { conversationId: string }).conversationId)).emit('message:updated', {
          id: (msg as { id: string }).id,
          body: (msg as { body: string | null }).body,
          editedAt: new Date().toISOString(),
        });
        cb?.({ ok: true });
      } catch (e) {
        cb?.(failAck(e));
      }
    });

    socket.on('message:delete', async ({ messageId }, cb) => {
      try {
        const msg = await messagesService.softDelete(new Types.ObjectId(userId), messageId);
        io.to(convRoom((msg as { conversationId: string }).conversationId)).emit('message:deleted', {
          id: (msg as { id: string }).id,
        });
        cb?.({ ok: true });
      } catch (e) {
        cb?.(failAck(e));
      }
    });

    socket.on('message:read', async ({ conversationId, uptoMessageId }) => {
      try {
        const { ids } = await messagesService.markRead(
          new Types.ObjectId(userId),
          conversationId,
          uptoMessageId,
        );
        if (!ids.length) return;

        /* The unread counter always clears, but a reader who turned read
           receipts off never tells senders that they looked. */
        const reader = await User.findById(userId).select({ privacy: 1 }).lean();
        if (reader && !privacyOf(reader).showReadReceipts) return;

        io.to(convRoom(conversationId)).emit('message:status', {
          ids,
          status: 'read',
          at: new Date().toISOString(),
        });
      } catch (err) {
        logger.warn({ err }, 'message:read failed');
      }
    });

    socket.on('message:react', async ({ messageId, emoji }, cb) => {
      try {
        const msg = await messagesService.react(new Types.ObjectId(userId), messageId, emoji);
        const updated = msg as { id: string; conversationId: string; reactions: unknown };
        io.to(convRoom(updated.conversationId)).emit('message:reactions', {
          id: updated.id,
          conversationId: updated.conversationId,
          reactions: updated.reactions,
        });
        cb?.({ ok: true });
      } catch (e) {
        cb?.(failAck(e));
      }
    });

    socket.on('typing:start', async ({ conversationId }) => {
      if (!(await assertMember(conversationId, userId))) return;
      socket.to(convRoom(conversationId)).emit('typing:update', {
        conversationId,
        userId,
        isTyping: true,
      });
    });

    socket.on('typing:stop', async ({ conversationId }) => {
      if (!(await assertMember(conversationId, userId))) return;
      socket.to(convRoom(conversationId)).emit('typing:update', {
        conversationId,
        userId,
        isTyping: false,
      });
    });

    socket.on('disconnect', () => {
      presence
        .onDisconnect(userId)
        .then(async ({ transitioned, lastSeenAt }) => {
          if (transitioned) await emitPresence(io, userId, false, lastSeenAt);
        })
        .catch((err) => logger.error({ err }, 'presence disconnect failed'));
    });
  });

  return io;
}
