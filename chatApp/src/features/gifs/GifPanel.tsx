import React, { useEffect, useState } from 'react';
import { View, TextInput, Pressable, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { gifsApi, type Gif } from './gifsApi';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';

type Props = {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  /** Carried through so a sticker or GIF can answer a specific message. */
  replyToId?: string | null;
};

export const GifPanel: React.FC<Props> = ({ visible, onClose, conversationId, replyToId }) => {
  const theme = useTheme();
  const senderId = useAuthStore((s) => s.user?.id);
  const sendMedia = useMessageStore((s) => s.sendMedia);

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    const run = query.trim()
      ? gifsApi.search(query.trim())
      : gifsApi.trending();
    run
      .then((res) => {
        if (!cancelled) setItems(res);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, visible]);

  const pick = async (g: Gif) => {
    onClose();
    if (!senderId) return;
    await sendMedia({
      conversationId,
      senderId,
      type: 'gif',
      media: {
        url: g.url,
        mime: g.mime,
        width: g.width,
        height: g.height,
        thumbUrl: g.previewUrl,
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
          <Text variant="bodyStrong">GIFs</Text>
          <View style={{ width: 50 }} />
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search GIFs"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.search,
            {
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              borderRadius: theme.radius.md,
            },
          ]}
        />
        {loading ? (
          <View style={{ padding: 24 }}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : (
          <FlashList
            data={items}
            numColumns={2}
            keyExtractor={(g) => g.id}
            contentContainerStyle={{ padding: 8 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => pick(item)} style={styles.cell}>
                <Image
                  source={{ uri: item.previewUrl }}
                  style={styles.cellImg}
                  contentFit="cover"
                  transition={100}
                />
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
  search: { height: 44, margin: 12, paddingHorizontal: 14, fontSize: 16 },
  cell: { flex: 1, aspectRatio: 1, padding: 4 },
  cellImg: { flex: 1, borderRadius: 12 },
});
