import React, { memo } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { MessageStatusIcon, STATUS_LABEL } from './MessageStatus';
import { ReactionRow } from './ReactionRow';
import type { Message } from '@/types';

type Props = {
  message: Message;
  isMe: boolean;
  /** The message this one answers, when it is loaded. */
  replyTo?: Message | null;
  replyToName?: string;
  senderName?: string;
  onLongPress: () => void;
  onRetry: () => void;
  onPressReply?: (messageId: string) => void;
  /** Highlighted briefly after jumping to a search result. */
  highlighted?: boolean;
};

const previewOf = (m: Message): string => {
  if (m.deletedAt) return 'Deleted message';
  switch (m.type) {
    case 'image':
      return 'Photo';
    case 'video':
      return 'Video';
    case 'gif':
      return 'GIF';
    case 'sticker':
      return 'Sticker';
    default:
      return m.body ?? '';
  }
};

const MessageBubbleImpl: React.FC<Props> = ({
  message,
  isMe,
  replyTo,
  replyToName,
  senderName,
  onLongPress,
  onRetry,
  onPressReply,
  highlighted,
}) => {
  const theme = useTheme();
  const failed = message.status === 'failed';
  const queued = message.status === 'sending';
  const metaColor = isMe ? 'bubbleOutMeta' : 'bubbleInMeta';

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const a11y = [
    message.deletedAt ? 'Deleted message' : `${isMe ? 'You' : 'They'} said: ${message.body ?? ''}`,
    replyTo ? `replying to ${previewOf(replyTo)}` : null,
    message.editedAt ? 'edited' : null,
    time,
    isMe ? STATUS_LABEL[message.status] : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Animated.View
      entering={theme.reducedMotion ? undefined : FadeIn.duration(theme.motion.fast)}
    >
      <Pressable
        onPress={failed ? onRetry : undefined}
        onLongPress={onLongPress}
        delayLongPress={250}
        accessibilityRole={failed ? 'button' : 'text'}
        accessibilityLabel={failed ? `${a11y}. Tap to retry sending.` : a11y}
        accessibilityHint={failed ? undefined : 'Long press for message actions'}
      >
        <View
          style={[
            {
              alignSelf: isMe ? 'flex-end' : 'flex-start',
              backgroundColor: isMe ? theme.colors.bubbleOut : theme.colors.bubbleIn,
              paddingHorizontal: theme.spacing.md,
              paddingTop: theme.spacing.sm - 2,
              paddingBottom: theme.spacing.xs + 1,
              borderRadius: theme.radius.lg,
              borderTopRightRadius: isMe ? 4 : theme.radius.lg,
              borderTopLeftRadius: isMe ? theme.radius.lg : 4,
              marginVertical: 1,
              maxWidth: '82%',
              opacity: queued ? 0.7 : 1,
              borderWidth: failed || highlighted ? 1.5 : 0,
              borderColor: failed ? theme.colors.danger : theme.colors.accentSoft,
            },
            theme.elevation[1],
          ]}
        >
          {replyTo ? (
            <Pressable
              onPress={() => onPressReply?.(replyTo.id)}
              accessibilityRole="button"
              accessibilityLabel={`Jump to replied message: ${previewOf(replyTo)}`}
              style={{
                borderLeftWidth: 3,
                borderLeftColor: isMe ? theme.colors.accentSoft : theme.colors.accent,
                paddingLeft: theme.spacing.sm,
                paddingVertical: 2,
                marginBottom: theme.spacing.xs,
                borderRadius: 3,
              }}
            >
              <Text variant="caption" color={isMe ? 'bubbleOutMeta' : 'accent'}>
                {replyToName ?? 'Reply'}
              </Text>
              <Text
                variant="small"
                color={metaColor}
                numberOfLines={1}
                style={{ opacity: 0.9 }}
              >
                {previewOf(replyTo)}
              </Text>
            </Pressable>
          ) : null}

          {!isMe && senderName ? (
            <Text
              variant="caption"
              color="accent"
              numberOfLines={1}
              style={{ fontWeight: '600', marginBottom: 2 }}
            >
              {senderName}
            </Text>
          ) : null}

          {message.deletedAt ? (
            <Text color={metaColor} style={{ fontStyle: 'italic' }}>
              Message deleted
            </Text>
          ) : (
            <Text style={{ color: isMe ? theme.colors.bubbleOutText : theme.colors.bubbleInText }}>
              {message.body}
            </Text>
          )}

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 4,
              marginTop: 2,
            }}
          >
            {message.editedAt && !message.deletedAt ? (
              <Text variant="caption" color={metaColor}>
                edited
              </Text>
            ) : null}
            {message.expiresAt ? (
              <Icon name="timer" size={11} color={isMe ? 'bubbleOutMeta' : 'bubbleInMeta'} />
            ) : null}
            <Text variant="caption" color={metaColor} style={{ fontSize: 11 }}>
              {time}
            </Text>
            {isMe ? (
              <MessageStatusIcon
                status={message.status}
                color={theme.colors.bubbleOutMeta}
                readColor={theme.colors.accentSoft}
                failedColor={theme.colors.danger}
                size={14}
              />
            ) : null}
          </View>
        </View>
      </Pressable>

      <ReactionRow message={message} align={isMe ? 'right' : 'left'} />

      {failed ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry sending this message"
          style={{
            alignSelf: isMe ? 'flex-end' : 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingVertical: 2,
          }}
        >
          <Icon name="retry" size="xs" color="danger" />
          <Text variant="caption" color="danger">
            Not sent. Tap to retry
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
};

export const MessageBubble = memo(
  MessageBubbleImpl,
  (a, b) =>
    a.isMe === b.isMe &&
    a.highlighted === b.highlighted &&
    a.message.id === b.message.id &&
    a.message.status === b.message.status &&
    a.message.body === b.message.body &&
    a.message.deletedAt === b.message.deletedAt &&
    a.message.editedAt === b.message.editedAt &&
    a.message.reactions === b.message.reactions &&
    a.replyTo?.id === b.replyTo?.id &&
    a.replyTo?.body === b.replyTo?.body,
);
