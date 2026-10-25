import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { User } from '../../models/User';
import { logger } from '../../lib/logger';

type PushJob = {
  recipientUserId: string;
  conversationId: string;
  senderDisplayName: string;
  messageType: 'text' | 'image' | 'video' | 'gif' | 'sticker';
  bodyPreview?: string | null;
};

const expo = new Expo();

/* Plain words only: a push body is OS-rendered text with no room for the
   app's icon set, and an emoji stand-in there is exactly what we removed
   from the interface. */
function previewFor(job: PushJob): string {
  switch (job.messageType) {
    case 'image':
      return 'Photo';
    case 'video':
      return 'Video';
    case 'gif':
      return 'GIF';
    case 'sticker':
      return 'Sticker';
    case 'text':
      return job.bodyPreview?.trim() ? job.bodyPreview : 'New message';
  }
}

function invalidateTokensFromTickets(tokens: string[], tickets: ExpoPushTicket[]): string[] {
  const bad: string[] = [];
  tickets.forEach((t, i) => {
    if (t.status === 'error') {
      const details = t.details as { error?: string } | undefined;
      if (details?.error === 'DeviceNotRegistered' && tokens[i]) {
        bad.push(tokens[i]!);
      }
    }
  });
  return bad;
}

export const pushDispatcher = {
  async send(job: PushJob): Promise<void> {
    const user = await User.findById(job.recipientUserId)
      .select('+pushToken pushPrefs')
      .lean();
    if (!user) return;

    const prefs = user.pushPrefs ?? { enabled: true, showPreview: true };
    if (!prefs.enabled) return;

    const token = user.pushToken;
    if (!token || !Expo.isExpoPushToken(token)) return;

    const body = prefs.showPreview ? previewFor(job) : 'New message';
    const title = prefs.showPreview ? job.senderDisplayName : 'Whisper';

    const message: ExpoPushMessage = {
      to: token,
      title,
      body,
      sound: 'default',
      priority: 'high',
      channelId: 'messages',
      data: { conversationId: job.conversationId },
      categoryId: 'message',
    };

    try {
      const [ticket] = await expo.sendPushNotificationsAsync([message]);
      if (!ticket) return;
      const bad = invalidateTokensFromTickets([token], [ticket]);
      if (bad.length) {
        await User.updateOne({ _id: job.recipientUserId }, { $set: { pushToken: null } });
      }
    } catch (err) {
      logger.warn({ err }, 'push dispatch failed');
    }
  },
};
