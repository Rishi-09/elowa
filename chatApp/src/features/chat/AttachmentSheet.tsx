import React, { useState } from 'react';
import { View, Pressable, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { mediaService, PermissionError } from '@/features/media/mediaService';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';

type Mode = 'none' | 'attachment' | 'gif' | 'sticker';

type Props = {
  visible: boolean;
  mode: Mode;
  onClose: () => void;
  onOpenGif: () => void;
  onOpenSticker: () => void;
  conversationId: string;
  /** Carried through so an attachment can answer a specific message. */
  replyToId?: string | null;
};

export const AttachmentSheet: React.FC<Props> = ({
  visible,
  mode,
  onClose,
  onOpenGif,
  onOpenSticker,
  conversationId,
  replyToId,
}) => {
  const theme = useTheme();
  const senderId = useAuthStore((s) => s.user?.id);
  const sendMediaFile = useMessageStore((s) => s.sendMediaFile);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  if (mode !== 'attachment' && !error) return null;

  /**
   * Media is uploaded through the server-signed path and only then attached to
   * a message, so what the recipient sees is backed by stored bytes.
   */
  const pick = (source: 'library' | 'camera', allowVideos = false) => async () => {
    onClose();
    if (!senderId) return;
    try {
      const asset =
        source === 'camera'
          ? await mediaService.captureFromCamera()
          : await mediaService.pickFromLibrary({ allowVideos });
      if (!asset) return;
      await sendMediaFile({ conversationId, senderId, asset, replyToId });
    } catch (e) {
      if (e instanceof PermissionError) {
        setError({ title: 'Permission needed', message: e.message });
        return;
      }
      setError({
        title: 'Could not send',
        message: e instanceof Error ? e.message : 'Something went wrong. Try again.',
      });
    }
  };

  return (
    <>
      <Modal
        transparent
        animationType={theme.reducedMotion ? 'none' : 'slide'}
        visible={visible && mode === 'attachment'}
        onRequestClose={onClose}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss attachment menu"
        >
          <Pressable onPress={(e) => e.stopPropagation()} accessibilityViewIsModal>
            <SafeAreaView
              edges={['bottom']}
              style={[
                styles.sheet,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  borderTopLeftRadius: theme.radius.xxl,
                  borderTopRightRadius: theme.radius.xxl,
                },
                theme.elevation[3],
              ]}
            >
              <Text variant="label" color="textMuted" accessibilityRole="header">
                SHARE
              </Text>
              <View style={styles.grid}>
                <Tile icon="photo" label="Photo" onPress={pick('library')} />
                <Tile icon="video" label="Video" onPress={pick('library', true)} />
                <Tile icon="camera" label="Camera" onPress={pick('camera')} />
                <Tile icon="gif" label="GIF" onPress={onOpenGif} />
                <Tile icon="sticker" label="Sticker" onPress={onOpenSticker} />
              </View>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={!!error}
        title={error?.title ?? ''}
        message={error?.message}
        confirmLabel="OK"
        cancelLabel="Dismiss"
        onConfirm={() => setError(null)}
        onCancel={() => setError(null)}
      />
    </>
  );
};

const Tile: React.FC<{ icon: IconName; label: string; onPress: () => void }> = ({
  icon,
  label,
  onPress,
}) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon name={icon} size="xl" color="accent" />
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 16, paddingTop: 20, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '30%',
    aspectRatio: 1.15,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
