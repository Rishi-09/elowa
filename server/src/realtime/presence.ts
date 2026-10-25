import { User } from '../models/User';

const counts = new Map<string, number>();

export const presence = {
  async onConnect(userId: string): Promise<boolean> {
    const prev = counts.get(userId) ?? 0;
    counts.set(userId, prev + 1);
    if (prev === 0) {
      await User.updateOne({ _id: userId }, { $set: { isOnline: true, lastSeenAt: new Date() } });
      return true;
    }
    return false;
  },

  async onDisconnect(userId: string): Promise<{ transitioned: boolean; lastSeenAt: Date | null }> {
    const prev = counts.get(userId) ?? 0;
    const next = Math.max(0, prev - 1);
    if (next === 0) {
      counts.delete(userId);
      const now = new Date();
      await User.updateOne({ _id: userId }, { $set: { isOnline: false, lastSeenAt: now } });
      return { transitioned: true, lastSeenAt: now };
    }
    counts.set(userId, next);
    return { transitioned: false, lastSeenAt: null };
  },

  isOnline(userId: string): boolean {
    return (counts.get(userId) ?? 0) > 0;
  },
};
