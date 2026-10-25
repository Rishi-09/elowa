import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, Modal, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Empty } from '@/components/ui/Empty';
import { stickersApi, type Sticker, type StickerPack } from './stickersApi';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import { localCache, type StoredSticker } from '@/services/localCache';
import { mediaService, PermissionError } from '@/features/media/mediaService';

type Props = {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  /** Carried through so a sticker or GIF can answer a specific message. */
  replyToId?: string | null;
  onOpenGif?: () => void;
};

/** Either a server pack sticker or one the user imported — same shape on screen. */
type PanelSticker = StoredSticker;

/* The two synthetic tabs that precede the server packs. */
const RECENT_TAB = 'recent';
const FAVOURITES_TAB = 'favourites';
const CUSTOM_TAB = 'custom';

const toStored = (s: Sticker): StoredSticker => ({
  id: s.id,
  packId: s.packId,
  url: s.url,
  width: s.width,
  height: s.height,
});

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
  const [activeTab, setActiveTab] = useState<string>(RECENT_TAB);
  const [packStickers, setPackStickers] = useState<PanelSticker[]>([]);
  const [recents, setRecents] = useState<PanelSticker[]>([]);
  const [favourites, setFavourites] = useState<PanelSticker[]>([]);
  const [custom, setCustom] = useState<PanelSticker[]>([]);
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /* One automatic tab choice per opening. */
  const autoSelected = useRef(false);

  const refreshLocal = useCallback(async () => {
    const [r, f, c] = await Promise.all([
      localCache.listStickerRecents().catch(() => []),
      localCache.listStickerFavourites().catch(() => []),
      localCache.listCustomStickers().catch(() => []),
    ]);
    setRecents(r);
    setFavourites(f);
    setCustom(c);
    setFavouriteIds(new Set(f.map((s) => s.id)));
  }, []);

  useEffect(() => {
    if (!visible) {
      autoSelected.current = false;
      return;
    }
    setNotice(null);
    void refreshLocal();
    stickersApi
      .listPacks()
      .then(setPacks)
      .catch(() => setPacks([]));
  }, [visible, refreshLocal]);

  /* Land on whichever tab has something in it, so the panel never opens empty
     just because nothing has been used yet. This waits for the local reads and
     the pack fetch to land — running it on `visible` alone picked a tab from
     stale counts, because the panel stays mounted between openings. Latches so
     it cannot yank the tab out from under the user mid-session. */
  useEffect(() => {
    if (!visible || autoSelected.current) return;
    if (!recents.length && !favourites.length && !packs.length && !custom.length) return;
    if (recents.length) setActiveTab(RECENT_TAB);
    else if (favourites.length) setActiveTab(FAVOURITES_TAB);
    else if (packs[0]) setActiveTab(packs[0].id);
    else setActiveTab(CUSTOM_TAB);
    autoSelected.current = true;
  }, [visible, recents.length, favourites.length, packs, custom.length]);

  useEffect(() => {
    const isPack = packs.some((p) => p.id === activeTab);
    if (!isPack) return;
    setLoading(true);
    stickersApi
      .listPackStickers(activeTab)
      .then((items) => setPackStickers(items.map(toStored)))
      .catch(() => setPackStickers([]))
      .finally(() => setLoading(false));
  }, [activeTab, packs]);

  const shown: PanelSticker[] = useMemo(() => {
    if (activeTab === RECENT_TAB) return recents;
    if (activeTab === FAVOURITES_TAB) return favourites;
    if (activeTab === CUSTOM_TAB) return custom;
    return packStickers;
  }, [activeTab, recents, favourites, custom, packStickers]);

  const pick = async (s: PanelSticker) => {
    if (!senderId) return;
    /* Record before closing: the panel unmounts its state on close. */
    await localCache.recordStickerUse(s).catch(() => {});
    onClose();
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

  const toggleFavourite = async (s: PanelSticker) => {
    const isFav = favouriteIds.has(s.id);
    if (isFav) await localCache.removeStickerFavourite(s.id).catch(() => {});
    else await localCache.addStickerFavourite(s).catch(() => {});
    await refreshLocal();
  };

  /* Imported stickers are uploaded so the other side can load them; a
     device-local file:// URI would arrive as a broken image. */
  const importSticker = async () => {
    setNotice(null);
    setImporting(true);
    try {
      const asset = await mediaService.pickFromLibrary();
      if (!asset) return;
      const ref = await mediaService.upload(asset);
      await localCache.addCustomSticker({
        id: ref.url,
        url: ref.url,
        width: ref.width ?? asset.width ?? 512,
        height: ref.height ?? asset.height ?? 512,
      });
      await refreshLocal();
      setActiveTab(CUSTOM_TAB);
    } catch (e) {
      setNotice(
        e instanceof PermissionError
          ? e.message
          : 'That sticker could not be imported. Check your connection and try again.',
      );
    } finally {
      setImporting(false);
    }
  };

  const removeCustom = async (s: PanelSticker) => {
    await localCache.removeCustomSticker(s.id).catch(() => {});
    await refreshLocal();
  };

  const emptyFor = (tab: string) => {
    if (tab === RECENT_TAB)
      return { icon: 'recent' as const, title: 'No recent stickers', subtitle: 'Stickers you send show up here.' };
    if (tab === FAVOURITES_TAB)
      return { icon: 'heart' as const, title: 'No favourites yet', subtitle: 'Press and hold any sticker to favourite it.' };
    if (tab === CUSTOM_TAB)
      return { icon: 'sticker' as const, title: 'No imported stickers', subtitle: 'Add images from your phone to use them as stickers.' };
    return { icon: 'sticker' as const, title: 'No stickers', subtitle: 'This pack is empty.' };
  };

  const tabStyle = (key: string) => ({
    padding: 6,
    borderRadius: theme.radius.md,
    backgroundColor: activeTab === key ? theme.colors.accentMuted : theme.colors.surface,
  });

  const empty = emptyFor(activeTab);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text color="accent" variant="bodyStrong">
              Close
            </Text>
          </Pressable>
          <Text variant="bodyStrong">Stickers</Text>
          {onOpenGif ? (
            <Pressable onPress={onOpenGif} hitSlop={10} accessibilityRole="button">
              <Text color="accent" variant="bodyStrong">
                GIFs
              </Text>
            </Pressable>
          ) : (
            <View style={{ width: 50 }} />
          )}
        </View>

        {/* flexGrow/flexShrink 0: a ScrollView in a flex column otherwise
            expands to fill the panel and pushes the grid off-screen. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.packsScroll}
          contentContainerStyle={styles.packs}
        >
          <Pressable
            onPress={() => setActiveTab(RECENT_TAB)}
            accessibilityRole="tab"
            accessibilityLabel="Recent stickers"
            accessibilityState={{ selected: activeTab === RECENT_TAB }}
            style={tabStyle(RECENT_TAB)}
          >
            <Icon name="recent" size="lg" color={activeTab === RECENT_TAB ? 'accent' : 'textMuted'} />
          </Pressable>

          <Pressable
            onPress={() => setActiveTab(FAVOURITES_TAB)}
            accessibilityRole="tab"
            accessibilityLabel="Favourite stickers"
            accessibilityState={{ selected: activeTab === FAVOURITES_TAB }}
            style={tabStyle(FAVOURITES_TAB)}
          >
            <Icon name="heart" size="lg" color={activeTab === FAVOURITES_TAB ? 'accent' : 'textMuted'} />
          </Pressable>

          {packs.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setActiveTab(p.id)}
              accessibilityRole="tab"
              accessibilityLabel={p.name}
              accessibilityState={{ selected: activeTab === p.id }}
              style={tabStyle(p.id)}
            >
              <Image source={{ uri: p.coverUrl }} style={styles.packCover} contentFit="contain" />
            </Pressable>
          ))}

          <Pressable
            onPress={() => setActiveTab(CUSTOM_TAB)}
            accessibilityRole="tab"
            accessibilityLabel="My stickers"
            accessibilityState={{ selected: activeTab === CUSTOM_TAB }}
            style={tabStyle(CUSTOM_TAB)}
          >
            <Icon name="profile" size="lg" color={activeTab === CUSTOM_TAB ? 'accent' : 'textMuted'} />
          </Pressable>

          <Pressable
            onPress={importSticker}
            disabled={importing}
            accessibilityRole="button"
            accessibilityLabel="Import a sticker from your photos"
            style={[tabStyle('import'), { backgroundColor: theme.colors.surface }]}
          >
            {importing ? (
              <ActivityIndicator color={theme.colors.accent} />
            ) : (
              <Icon name="add" size="lg" color="accent" />
            )}
          </Pressable>
        </ScrollView>

        {notice ? (
          <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
            <Text variant="small" color="danger">
              {notice}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={{ padding: 24 }}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : shown.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Empty
              icon={empty.icon}
              title={empty.title}
              subtitle={empty.subtitle}
              {...(activeTab === CUSTOM_TAB
                ? { actionLabel: 'Import a sticker', onAction: importSticker }
                : {})}
            />
          </View>
        ) : (
          <FlashList
            data={shown}
            numColumns={4}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ padding: 8 }}
            extraData={favouriteIds}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => pick(item)}
                onLongPress={() =>
                  activeTab === CUSTOM_TAB ? removeCustom(item) : toggleFavourite(item)
                }
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityLabel={
                  activeTab === CUSTOM_TAB
                    ? 'Sticker. Press and hold to remove.'
                    : favouriteIds.has(item.id)
                      ? 'Sticker, favourited. Press and hold to unfavourite.'
                      : 'Sticker. Press and hold to favourite.'
                }
                style={styles.cell}
              >
                <Image source={{ uri: item.url }} style={styles.cellImg} contentFit="contain" />
                {favouriteIds.has(item.id) && activeTab !== FAVOURITES_TAB ? (
                  <View style={styles.favBadge}>
                    <Icon name="heart" size="xs" color="accent" />
                  </View>
                ) : null}
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
  packsScroll: { flexGrow: 0, flexShrink: 0 },
  packs: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'center' },
  packCover: { width: 36, height: 36 },
  cell: { flex: 1, aspectRatio: 1, padding: 6 },
  cellImg: { flex: 1 },
  favBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
  },
});
