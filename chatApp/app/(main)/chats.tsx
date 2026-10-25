import React, { useCallback, useEffect } from 'react';
import { View, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Empty } from '@/components/ui/Empty';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ConversationSkeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme/ThemeProvider';
import { conversationsApi } from '@/features/conversations/conversationsApi';
import { socketClient } from '@/services/socket';
import type { Conversation } from '@/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ElowaLogo } from '@/components/ui/ElowaLogo';

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Last-message preview: an icon plus a label, never an emoji stand-in. */
function previewOf(c: Conversation): { icon: IconName | null; text: string } {
  const m = c.lastMessage;
  if (!m) return { icon: null, text: 'Say hi' };
  switch (m.type) {
    case 'image':
      return { icon: 'photo', text: 'Photo' };
    case 'video':
      return { icon: 'video', text: 'Video' };
    case 'gif':
      return { icon: 'gif', text: 'GIF' };
    case 'sticker':
      return { icon: 'sticker', text: 'Sticker' };
    default:
      return { icon: null, text: m.body ?? '' };
  }
}

export default function ChatsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, isRefetching, isError, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: conversationsApi.list,
    staleTime: 15_000,
  });

  useEffect(() => {
    const offs = [
      socketClient.on('message:new', () => {
        qc.invalidateQueries({ queryKey: ['conversations'] });
      }),
      socketClient.on('presence:update', () => {
        qc.invalidateQueries({ queryKey: ['conversations'] });
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [qc]);

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const isGroup = item.type === 'group';
      const displayName = isGroup ? item.title || 'Group' : item.peer.displayName;
      const avatarUri = isGroup ? item.avatarUrl || item.peer.avatarUrl : item.peer.avatarUrl;
      const preview = previewOf(item);
      const a11y = [
        isGroup ? `Group: ${displayName}` : `Conversation with ${displayName}`,
        preview.text,
        item.unreadCount > 0 ? `${item.unreadCount} unread` : null,
      ]
        .filter(Boolean)
        .join('. ');

      return (
        <Pressable
          onPress={() => router.push(`/(main)/chat/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={a11y}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: pressed ? theme.colors.surface : 'transparent' },
          ]}
        >
          <Avatar
            name={displayName}
            uri={avatarUri}
            online={isGroup ? false : item.peer.isOnline}
            ringColor={theme.colors.bg}
            size={52}
          />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={styles.rowLine}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {isGroup ? <Icon name="group" size={14} color="textMuted" /> : null}
                <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                  {displayName}
                </Text>
              </View>
              <Text variant="caption" color="textMuted" style={{ marginLeft: 8 }}>
                {formatTime(item.lastMessageAt)}
              </Text>
            </View>
            <View style={styles.rowLine}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                {preview.icon ? <Icon name={preview.icon} size="sm" color="textSubtle" /> : null}
                <Text variant="small" color="textMuted" numberOfLines={1} style={{ flex: 1 }}>
                  {preview.text}
                </Text>
              </View>
              <Badge count={item.unreadCount} />
            </View>
          </View>
        </Pressable>
      );
    },
    [router, theme],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.header }}>
        <View style={styles.headerBar}>
          <IconButton
            name="menu"
            accessibilityLabel="Open settings"
            color="headerText"
            diameter={40}
            onPress={() => router.push('/(main)/settings')}
          />
          <ElowaLogo
            size={28}
            color={theme.colors.accent}
            textColor={theme.colors.headerText}
          />
          <IconButton
            name="search"
            accessibilityLabel="Search people"
            color="headerText"
            diameter={40}
            onPress={() => router.push('/(main)/new-chat')}
          />
        </View>
      </SafeAreaView>

      {isLoading ? (
        <ConversationSkeleton />
      ) : isError ? (
        <ErrorState
          title="Couldn't load chats"
          message="Check your connection and try again."
          onRetry={() => refetch()}
        />
      ) : (
        <FlashList
          data={data ?? []}
          keyExtractor={(c) => c.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.accent}
            />
          }
          ItemSeparatorComponent={() => (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginLeft: 76 }} />
          )}
          ListEmptyComponent={
            <Empty
              icon="message"
              title="No conversations yet"
              subtitle="Find someone by username and send the first message."
              actionLabel="Start a chat"
              onAction={() => router.push('/(main)/new-chat')}
            />
          }
          renderItem={renderItem}
        />
      )}

      <IconButton
        name="newChat"
        accessibilityLabel="Start a new chat"
        variant="filled"
        diameter={56}
        onPress={() => router.push('/(main)/new-chat')}
        style={[styles.fab, theme.elevation[3]]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 24,
  },
});
