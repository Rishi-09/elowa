import React, { memo, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { ImageViewer } from './ImageViewer';
import { VideoViewer } from './VideoViewer';
import { MessageStatusIcon } from './MessageStatus';
import { ReactionRow } from './ReactionRow';
import { mediaSource } from '@/features/media/mediaSource';
import type { Message } from '@/types';

type Props = {
  message: Message;
  isMe: boolean;
  senderName?: string;
  onLongPress?: () => void;
  onRetry?: () => void;
};

const MAX_W = 240;
const MAX_H = 320;

function fit(w?: number, h?: number): { width: number; height: number } {
  if (!w || !h) return { width: MAX_W, height: MAX_W };
  const ratio = w / h;
  if (ratio >= 1) {
    const width = Math.min(MAX_W, w);
    return { width, height: Math.round(width / ratio) };
  }
  const height = Math.min(MAX_H, h);
  return { width: Math.round(height * ratio), height };
}

const MediaBubbleImpl: React.FC<Props> = ({ message, isMe, senderName, onLongPress, onRetry }) => {
  const theme = useTheme();
  const media = message.media;
  const [imageOpen, setImageOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  if (message.deletedAt) {
    return (
      <View
        style={{
          alignSelf: isMe ? 'flex-end' : 'flex-start',
          backgroundColor: isMe ? theme.colors.bubbleOut : theme.colors.bubbleIn,
          padding: theme.spacing.md,
          borderRadius: theme.radius.lg,
          marginVertical: 1,
          maxWidth: '80%',
        }}
      >
        <Text
          color={isMe ? 'bubbleOutMeta' : 'textMuted'}
          style={{ fontStyle: 'italic' }}
          accessibilityLabel="Deleted message"
        >
          Message deleted
        </Text>
      </View>
    );
  }

  const dims = fit(media?.width, media?.height);
  const isSticker = message.type === 'sticker';
  const isVideo = message.type === 'video';
  const uploading = message.uploadProgress != null;
  const failed = message.status === 'failed';
  const displayUri = media?.url;
  const source = mediaSource(media?.thumbUrl ?? displayUri);

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const container = {
    alignSelf: (isMe ? 'flex-end' : 'flex-start') as 'flex-end' | 'flex-start',
    marginVertical: 1,
  };

  if (isSticker) {
    return (
      <Animated.View
        entering={theme.reducedMotion ? undefined : FadeIn.duration(theme.motion.fast)}
        style={container}
      >
        {!isMe && senderName ? (
          <Text
            variant="caption"
            color="accent"
            numberOfLines={1}
            style={{ fontWeight: '600', marginBottom: 2, paddingHorizontal: 4 }}
          >
            {senderName}
          </Text>
        ) : null}
        <Pressable
          onLongPress={onLongPress}
          accessibilityRole="image"
          accessibilityLabel="Sticker"
        >
          <Image
            source={mediaSource(media?.url)}
            style={{ width: 140, height: 140 }}
            contentFit="contain"
            transition={theme.reducedMotion ? 0 : theme.motion.fast}
          />
        </Pressable>
        <ReactionRow message={message} align={isMe ? 'right' : 'left'} />
      </Animated.View>
    );
  }

  const open = () => {
    if (uploading || !displayUri) return;
    if (isVideo) setVideoOpen(true);
    else setImageOpen(true);
  };

  const a11y = [
    isVideo ? 'Video message' : 'Photo message',
    uploading ? `uploading ${Math.round((message.uploadProgress ?? 0) * 100)} percent` : null,
    failed ? 'failed to send' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Animated.View
      entering={theme.reducedMotion ? undefined : FadeIn.duration(theme.motion.fast)}
      style={container}
    >
      {!isMe && senderName ? (
        <Text
          variant="caption"
          color="accent"
          numberOfLines={1}
          style={{ fontWeight: '600', marginBottom: 2, paddingHorizontal: 4 }}
        >
          {senderName}
        </Text>
      ) : null}
      <Pressable
        onPress={failed ? onRetry : open}
        onLongPress={onLongPress}
        accessibilityRole={failed ? 'button' : 'image'}
        accessibilityLabel={failed ? `${a11y}. Tap to retry.` : a11y}
      >
        <View
          style={{
            borderRadius: theme.radius.lg,
            borderTopRightRadius: isMe ? 4 : theme.radius.lg,
            borderTopLeftRadius: isMe ? theme.radius.lg : 4,
            overflow: 'hidden',
            backgroundColor: theme.colors.surfaceSunken,
            borderWidth: failed ? 1 : 0,
            borderColor: theme.colors.danger,
          }}
        >
          {source ? (
            <Image
              source={source}
              style={dims}
              contentFit="cover"
              transition={theme.reducedMotion ? 0 : theme.motion.fast}
            />
          ) : (
            <View style={[dims, { alignItems: 'center', justifyContent: 'center' }]}>
              <Icon name="photo" size="xl" color="textSubtle" />
            </View>
          )}

          {/* Upload progress: a real bar driven by bytes sent, not a fake timer */}
          {uploading ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.overlay,
                gap: theme.spacing.sm,
              }}
            >
              <Icon name="pending" size="lg" color="#FFFFFF" />
              <View
                style={{
                  width: '60%',
                  height: 4,
                  borderRadius: 2,
                  overflow: 'hidden',
                  backgroundColor: 'rgba(255,255,255,0.28)',
                }}
              >
                <View
                  style={{
                    width: `${Math.round((message.uploadProgress ?? 0) * 100)}%`,
                    height: 4,
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </View>
            </View>
          ) : null}

          {isVideo && !uploading ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="play" size="lg" color="#FFFFFF" />
              </View>
            </View>
          ) : null}

          <View
            style={{
              position: 'absolute',
              right: 6,
              bottom: 5,
              backgroundColor: 'rgba(0,0,0,0.45)',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: theme.radius.sm,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text variant="caption" style={{ color: '#FFFFFF', fontSize: 11 }}>
              {time}
            </Text>
            {isMe ? (
              <MessageStatusIcon
                status={message.status}
                color="rgba(255,255,255,0.78)"
                readColor={theme.colors.accentSoft}
                failedColor={theme.colors.danger}
                size={13}
              />
            ) : null}
          </View>
        </View>
      </Pressable>

      <ReactionRow message={message} align={isMe ? 'right' : 'left'} />

      <ImageViewer
        visible={imageOpen}
        uri={displayUri ?? null}
        onClose={() => setImageOpen(false)}
      />
      <VideoViewer
        visible={videoOpen}
        uri={displayUri ?? null}
        onClose={() => setVideoOpen(false)}
      />
    </Animated.View>
  );
};

export const MediaBubble = memo(
  MediaBubbleImpl,
  (a, b) =>
    a.isMe === b.isMe &&
    a.message.id === b.message.id &&
    a.message.status === b.message.status &&
    a.message.uploadProgress === b.message.uploadProgress &&
    a.message.media?.url === b.message.media?.url &&
    a.message.deletedAt === b.message.deletedAt &&
    a.message.editedAt === b.message.editedAt &&
    a.message.reactions === b.message.reactions,
);
