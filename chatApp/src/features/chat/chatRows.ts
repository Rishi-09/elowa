import type { Message } from '@/types';

export type ChatRow =
  | { kind: 'message'; key: string; message: Message }
  | { kind: 'date'; key: string; label: string }
  | { kind: 'unread'; key: string; count: number };

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (iso: string): number => {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** "Today" / "Yesterday" / a readable date for anything older. */
export function dayLabel(iso: string, now = new Date()): string {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - startOfDay(iso)) / DAY_MS);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return new Date(iso).toLocaleDateString([], { weekday: 'long' });
  return new Date(iso).toLocaleDateString([], {
    month: 'long',
    day: 'numeric',
    year: today.getFullYear() === new Date(iso).getFullYear() ? undefined : 'numeric',
  });
}

/**
 * Turn the store's newest-first message list into oldest-first rows for the
 * bottom-anchored list, inserting a date separator whenever the calendar day
 * changes and a "new messages" marker above the oldest unread incoming
 * message.
 *
 * `unreadCount` is the server's count for this reader, captured when the
 * screen opened so the marker does not creep while they read.
 */
export function buildChatRows(
  messages: Message[],
  options: { meId?: string; unreadCount?: number; now?: Date } = {},
): ChatRow[] {
  const { meId, unreadCount = 0, now = new Date() } = options;

  /* Walking newest -> oldest, the last incoming message within the reported
     count is the oldest one the reader has not seen. */
  let unreadSeen = 0;
  let unreadBoundaryId: string | null = null;
  if (unreadCount > 0 && meId) {
    for (const m of messages) {
      if (m.senderId === meId || m.deletedAt) continue;
      unreadSeen += 1;
      unreadBoundaryId = m.id;
      if (unreadSeen >= unreadCount) break;
    }
  }

  const ascending = [...messages].reverse();
  const rows: ChatRow[] = [];

  ascending.forEach((message, i) => {
    const previous = ascending[i - 1];
    if (!previous || startOfDay(previous.createdAt) !== startOfDay(message.createdAt)) {
      rows.push({
        kind: 'date',
        key: `date-${startOfDay(message.createdAt)}`,
        label: dayLabel(message.createdAt, now),
      });
    }

    if (unreadBoundaryId && message.id === unreadBoundaryId) {
      rows.push({ kind: 'unread', key: `unread-${message.id}`, count: unreadSeen });
    }

    rows.push({ kind: 'message', key: message.id, message });
  });

  return rows;
}
