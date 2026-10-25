import * as SQLite from 'expo-sqlite';
import type { Message } from '@/types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('elowa.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY NOT NULL,
          client_message_id TEXT,
          conversation_id TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          type TEXT NOT NULL,
          body TEXT,
          media_json TEXT,
          reply_to_id TEXT,
          reactions_json TEXT,
          status TEXT NOT NULL,
          edited_at TEXT,
          deleted_at TEXT,
          expires_at TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_messages_conv_created
          ON messages (conversation_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_messages_expires
          ON messages (expires_at)
          WHERE expires_at IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_messages_pending
          ON messages (status)
          WHERE status IN ('sending', 'failed');
        CREATE TABLE IF NOT EXISTS prefs (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

function toRow(m: Message): (string | null)[] {
  return [
    m.id,
    m.clientMessageId ?? null,
    m.conversationId,
    m.senderId,
    m.type,
    m.body ?? null,
    m.media ? JSON.stringify(m.media) : null,
    m.replyToId ?? null,
    m.reactions && m.reactions.length ? JSON.stringify(m.reactions) : null,
    m.status,
    m.editedAt ?? null,
    m.deletedAt ?? null,
    m.expiresAt ?? null,
    m.createdAt,
  ];
}

function fromRow(r: Record<string, unknown>): Message {
  const mediaJson = r['media_json'] as string | null;
  return {
    id: String(r['id']),
    clientMessageId: (r['client_message_id'] as string | null) ?? undefined,
    conversationId: String(r['conversation_id']),
    senderId: String(r['sender_id']),
    type: r['type'] as Message['type'],
    body: (r['body'] as string | null) ?? undefined,
    media: mediaJson ? (JSON.parse(mediaJson) as Message['media']) : undefined,
    replyToId: (r['reply_to_id'] as string | null) ?? null,
    reactions: r['reactions_json']
      ? (JSON.parse(String(r['reactions_json'])) as Message['reactions'])
      : [],
    status: r['status'] as Message['status'],
    editedAt: (r['edited_at'] as string | null) ?? null,
    deletedAt: (r['deleted_at'] as string | null) ?? null,
    expiresAt: (r['expires_at'] as string | null) ?? null,
    createdAt: String(r['created_at']),
  };
}

export const localCache = {
  async upsertMessages(messages: Message[]): Promise<void> {
    if (messages.length === 0) return;
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      for (const m of messages) {
        await db.runAsync(
          `INSERT INTO messages
             (id, client_message_id, conversation_id, sender_id, type, body, media_json,
              reply_to_id, reactions_json, status, edited_at, deleted_at, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             client_message_id = excluded.client_message_id,
             body = excluded.body,
             media_json = excluded.media_json,
             reactions_json = excluded.reactions_json,
             status = excluded.status,
             edited_at = excluded.edited_at,
             deleted_at = excluded.deleted_at,
             expires_at = excluded.expires_at`,
          toRow(m),
        );
      }
    });
  },

  async loadConversation(conversationId: string, limit = 100): Promise<Message[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM messages
       WHERE conversation_id = ?
         AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY created_at DESC
       LIMIT ?`,
      [conversationId, new Date().toISOString(), limit],
    );
    return rows.map(fromRow);
  },

  /**
   * Messages still waiting to reach the server. Reloaded at launch so a send
   * survives the app being killed before the socket acknowledged it.
   */
  async loadPending(): Promise<Message[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM messages
       WHERE status IN ('sending', 'failed')
       ORDER BY created_at ASC`,
    );
    return rows.map(fromRow);
  },

  /** Drop one row — used when a local id is replaced by the server id. */
  async deleteMessage(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM messages WHERE id = ?', [id]);
  },

  async deleteExpired(now = new Date()): Promise<number> {
    const db = await getDb();
    const result = await db.runAsync(
      `DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at <= ?`,
      [now.toISOString()],
    );
    return result.changes ?? 0;
  },

  /**
   * Read a device-local preference. Preferences are non-sensitive UI state
   * (theme choice, etc.) and deliberately survive sign-out, unlike messages.
   */
  async getPref(key: string): Promise<string | null> {
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM prefs WHERE key = ?',
        [key],
      );
      return row?.value ?? null;
    } catch {
      return null;
    }
  },

  async setPref(key: string, value: string): Promise<void> {
    try {
      const db = await getDb();
      await db.runAsync(
        `INSERT INTO prefs (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value],
      );
    } catch {
      /* preference persistence is best-effort */
    }
  },

  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.execAsync('DELETE FROM messages');
  },
};
