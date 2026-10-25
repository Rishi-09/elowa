import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { stickersApi, type Sticker, type StickerPack } from './stickersApi';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';

type Props = {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  /** Carried through so a sticker or GIF can answer a specific message. */
  replyToId?: string | null;
  onOpenGif?: () => void;
};

export const StickerPanel: React.FC<Props> = ({
  visible,
  onClose,
  conversationId,
  replyToId,
  onOpenGif,
}) => {
  const theme = useTheme();
  const senderId = useAuthStore((s) => s.user?.id);
  const sendMedia = useMessageStore((s) => s.sendMedia);

  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    stickersApi
      .listPacks()
      .then((p) => {
        setPacks(p);
        if (p[0]) setActivePackId(p[0].id);
      })
      .catch(() => setPacks([]));
  }, [visible]);

  useEffect(() => {
    if (!activePackId) return;
    setLoading(true);
    stickersApi
      .listPackStickers(activePackId)
      .then(setStickers)
      .catch(() => setStickers([]))
      .finally(() => setLoading(false));
  }, [activePackId]);

  const activePack = useMemo(
    () => packs.find((p) => p.id === activePackId) ?? null,
    [packs, activePackId],
  );

  const pick = async (s: Sticker) => {
    onClose();
    if (!senderId) return;
    await sendMedia({
      conversationId,
      senderId,
      type: 'sticker',
      media: {
        url: s.url,
        mime: 'image/webp',
        width: s.width,
        height: s.height,
      },
      replyToId,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text color="accent" variant="bodyStrong">
              Close
            </Text>
          </Pressable>
          <Text variant="bodyStrong">{activePack?.name ?? 'Stickers'}</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.packs}>
          {packs.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setActivePackId(p.id)}
              style={[
                styles.packTab,
                {
                  backgroundColor:
                    activePackId === p.id ? theme.colors.accentMuted : theme.colors.surface,
                  borderRadius: theme.radius.md,
                },
              ]}
            >
              <Image source={{ uri: p.coverUrl }} style={styles.packCover} contentFit="contain" />
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={{ padding: 24 }}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : (
          <FlashList
            data={stickers}
            numColumns={4}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ padding: 8 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => pick(item)} style={styles.cell}>
                <Image source={{ uri: item.url }} style={styles.cellImg} contentFit="contain" />
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingTop: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  packs: { flexDirection: 'row', gap: 8, padding: 12 },
  packTab: { padding: 6 },
  packCover: { width: 36, height: 36 },
  cell: { flex: 1, aspectRatio: 1, padding: 6 },
  cellImg: { flex: 1 },
});
