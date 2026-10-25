import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';

import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Empty } from '@/components/ui/Empty';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { ActionSheet, type SheetAction } from '@/components/ui/ActionSheet';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MessageSkeleton } from '@/components/ui/Skeleton';

import { useTheme } from '@/theme/ThemeProvider';
import { conversationsApi } from '@/features/conversations/conversationsApi';
import { messagesApi } from '@/features/messages/messagesApi';
import { socketClient } from '@/services/socket';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import { localCache } from '@/services/localCache';
import { AttachmentSheet } from '@/features/chat/AttachmentSheet';
import { GifPanel } from '@/features/gifs/GifPanel';
import { StickerPanel } from '@/features/stickers/StickerPanel';
import { MediaBubble } from '@/features/chat/MediaBubble';
import { MessageBubble } from '@/features/chat/MessageBubble';
import { Composer } from '@/features/chat/Composer';
import { ReactionPicker } from '@/features/chat/ReactionRow';
import { buildChatRows, type ChatRow } from '@/features/chat/chatRows';
import type { Conversation, Message } from '@/types';

const PAGE_SIZE = 30;
const TYPING_IDLE_MS = 2500;

type Sheet = 'none' | 'attachment' | 'gif' | 'sticker';

export default function ChatScreen() {
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { conversationId: raw } = useLocalSearchParams<{ conversationId: string }>();
  const conversationId = String(raw);
  const me = useAuthStore((s) => s.user?.id);

  const listRef = useRef<FlashListRef<ChatRow>>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingLocal = useRef(false);
  const cursor = useRef<string | null>(null);
  const reachedStart = useRef(false);
  const loadingOlder = useRef(false);
  /* Unread count as of screen entry, so the marker does not jump while reading. */
  const entryUnread = useRef<number | null>(null);

  const [draft, setDraft] = useState('');
  const [sheet, setSheet] = useState<Sheet>('none');
  const [selected, setSelected] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Message | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [atBottom, setAtBottom] = useState(true);

  const conv = useMessageStore((s) => s.byConv[conversationId]);
  const messages = useMemo(() => conv?.messages ?? [], [conv]);
  const peerTyping = (conv?.typingUserIds?.size ?? 0) > 0;

  const ensure = useMessageStore((s) => s.ensure);
  const prepend = useMessageStore((s) => s.prepend);
  const upsert = useMessageStore((s) => s.upsert);
  const markDeleted = useMessageStore((s) => s.markDeleted);
  const markEdited = useMessageStore((s) => s.markEdited);
  const markStatus = useMessageStore((s) => s.markStatus);
  const setReactions = useMessageStore((s) => s.setReactions);
  const setTyping = useMessageStore((s) => s.setTyping);
  const sendMsg = useMessageStore((s) => s.send);
  const retryMsg = useMessageStore((s) => s.retry);
  const editMsg = useMessageStore((s) => s.edit);
  const removeMsg = useMessageStore((s) => s.remove);
  const reactMsg = useMessageStore((s) => s.react);

  const { data: convs } = useQuery({
    queryKey: ['conversations'],
    queryFn: conversationsApi.list,
    staleTime: 15_000,
  });
  const conversation: Conversation | undefined = convs?.find((c) => c.id === conversationId);
  const peer = conversation?.peer;
  const peerName = peer?.displayName ?? 'Conversation';

  if (entryUnread.current === null && conversation) {
    entryUnread.current = conversation.unreadCount;
  }

  useEffect(() => {
    ensure(conversationId);
  }, [conversationId, ensure]);

  /** Newest incoming message we can acknowledge as read. */
  const markReadUpToLatest = useCallback(() => {
    const latestIncoming = messages.find((m) => m.senderId !== me);
    if (latestIncoming && latestIncoming.status !== 'read') {
      socketClient.emit('message:read', {
        conversationId,
        uptoMessageId: latestIncoming.id,
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    }
  }, [messages, me, conversationId, qc]);

  /* First paint: local cache, then the server page. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await localCache.loadConversation(conversationId, 60).catch(() => []);
      if (!cancelled && cached.length) {
        prepend(conversationId, cached);
        setInitialLoading(false);
      }
      try {
        const page = await messagesApi.list(conversationId, { limit: PAGE_SIZE });
        if (cancelled) return;
        prepend(conversationId, page.items);
        cursor.current = page.nextCursor;
        reachedStart.current = !page.nextCursor;
      } catch {
        /* Offline: the cache above is the fallback. */
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, prepend]);

  /* Acknowledge reads once history is on screen. */
  useEffect(() => {
    if (!initialLoading) markReadUpToLatest();
  }, [initialLoading, markReadUpToLatest]);

  /* Realtime wiring. Handlers are registered with the socket client, which
     keeps them across reconnects, so no event is lost mid-session. */
  useEffect(() => {
    socketClient.joinConversation(conversationId);
    const offs = [
      socketClient.on('message:new', (m) => {
        if (m.conversationId !== conversationId) return;
        upsert(conversationId, m);
        if (m.senderId !== me) {
          socketClient.emit('message:read', { conversationId, uptoMessageId: m.id });
        }
      }),
      socketClient.on('message:updated', ({ id, body, editedAt }) =>
        markEdited(conversationId, id, body, editedAt),
      ),
      socketClient.on('message:deleted', ({ id }) => markDeleted(conversationId, id)),
      socketClient.on('message:status', ({ ids, status }) =>
        markStatus(conversationId, ids, status),
      ),
      socketClient.on('message:reactions', ({ id, conversationId: cid, reactions }) => {
        if (cid === conversationId) setReactions(conversationId, id, reactions);
      }),
      socketClient.on('typing:update', ({ conversationId: cid, userId, isTyping }) => {
        if (cid !== conversationId || userId === me) return;
        setTyping(conversationId, userId, isTyping);
      }),
    ];
    return () => {
      offs.forEach((off) => off());
      socketClient.leaveConversation(conversationId);
    };
  }, [conversationId, me, upsert, markDeleted, markEdited, markStatus, setReactions, setTyping]);

  /* Stop advertising "typing" when leaving the screen. */
  useEffect(
    () => () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (isTypingLocal.current) {
        isTypingLocal.current = false;
        socketClient.emit('typing:stop', { conversationId });
      }
    },
    [conversationId],
  );

  const loadOlder = useCallback(async () => {
    if (loadingOlder.current || reachedStart.current || !cursor.current) return;
    loadingOlder.current = true;
    try {
      const page = await messagesApi.list(conversationId, {
        limit: PAGE_SIZE,
        before: cursor.current,
      });
      prepend(conversationId, page.items);
      cursor.current = page.nextCursor;
      reachedStart.current = !page.nextCursor || page.items.length === 0;
    } catch {
      /* Keep the cursor so the next scroll retries. */
    } finally {
      loadingOlder.current = false;
    }
  }, [conversationId, prepend]);

  const onChangeDraft = useCallback(
    (text: string) => {
      setDraft(text);
      if (editing) return;
      if (!isTypingLocal.current && text.length > 0) {
        isTypingLocal.current = true;
        socketClient.emit('typing:start', { conversationId });
      }
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        if (isTypingLocal.current) {
          isTypingLocal.current = false;
          socketClient.emit('typing:stop', { conversationId });
        }
      }, TYPING_IDLE_MS);
    },
    [conversationId, editing],
  );

  const submit = useCallback(async () => {
    const body = draft.trim();
    if (!body || !me) return;

    if (editing) {
      const target = editing;
      setEditing(null);
      setDraft('');
      try {
        await editMsg(conversationId, target.id, body);
      } catch {
        setActionError('That edit could not be saved.');
      }
      return;
    }

    setDraft('');
    if (isTypingLocal.current) {
      isTypingLocal.current = false;
      socketClient.emit('typing:stop', { conversationId });
    }
    const answering = replyTo?.id ?? null;
    setReplyTo(null);
    await sendMsg({ conversationId, senderId: me, body, replyToId: answering });
    listRef.current?.scrollToEnd({ animated: !theme.reducedMotion });
  }, [draft, me, editing, conversationId, editMsg, replyTo, sendMsg, theme.reducedMotion]);

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m] as const)), [messages]);

  const rows = useMemo(
    () =>
      buildChatRows(messages, {
        meId: me,
        unreadCount: entryUnread.current ?? 0,
      }),
    [messages, me],
  );

  const openActions = useCallback((message: Message) => setSelected(message), []);

  const jumpTo = useCallback(
    (messageId: string) => {
      const index = rows.findIndex((r) => r.kind === 'message' && r.message.id === messageId);
      if (index >= 0) {
        listRef.current?.scrollToIndex({
          index,
          animated: !theme.reducedMotion,
          viewPosition: 0.5,
        });
      }
    },
    [rows, theme.reducedMotion],
  );

  const actions = useMemo<SheetAction[]>(() => {
    if (!selected) return [];
    const mine = selected.senderId === me;
    const list: SheetAction[] = [];

    if (!selected.deletedAt) {
      list.push({
        key: 'reply',
        label: 'Reply',
        icon: 'reply',
        onPress: () => {
          setEditing(null);
          setReplyTo(selected);
        },
      });
    }
    if (selected.type === 'text' && selected.body && !selected.deletedAt) {
      list.push({
        key: 'copy',
        label: 'Copy text',
        icon: 'copy',
        onPress: () => void Clipboard.setStringAsync(selected.body ?? ''),
      });
    }
    if (mine && selected.type === 'text' && !selected.deletedAt) {
      list.push({
        key: 'edit',
        label: 'Edit',
        icon: 'edit',
        onPress: () => {
          setReplyTo(null);
          setEditing(selected);
          setDraft(selected.body ?? '');
        },
      });
    }
    if (selected.status === 'failed' && selected.clientMessageId) {
      list.push({
        key: 'retry',
        label: 'Try sending again',
        icon: 'retry',
        onPress: () => void retryMsg(conversationId, selected.clientMessageId!),
      });
    }
    if (mine && !selected.deletedAt) {
      list.push({
        key: 'delete',
        label: 'Delete',
        icon: 'delete',
        destructive: true,
        onPress: () => setConfirmDelete(selected),
      });
    }
    return list;
  }, [selected, me, conversationId, retryMsg]);

  const renderRow = useCallback(
    ({ item }: { item: ChatRow }) => {
      if (item.kind === 'date') {
        return (
          <View style={styles.separatorWrap}>
            <View
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: 3,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.surfaceElevated,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.colors.border,
              }}
            >
              <Text variant="caption" color="textMuted" accessibilityRole="header">
                {item.label}
              </Text>
            </View>
          </View>
        );
      }

      if (item.kind === 'unread') {
        return (
          <View style={styles.separatorWrap}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: 3,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.accentMuted,
              }}
            >
              <Icon name="scrollDown" size="xs" color="accent" />
              <Text variant="caption" color="accent">
                {item.count} new {item.count === 1 ? 'message' : 'messages'}
              </Text>
            </View>
          </View>
        );
      }

      const message = item.message;
      const isMe = message.senderId === me;
      const sender = conversation?.members?.find((m) => m.id === message.senderId);
      const senderName =
        conversation?.type === 'group' && !isMe
          ? sender?.displayName || sender?.username
          : undefined;
      const parent = message.replyToId ? byId.get(message.replyToId) ?? null : null;
      const parentSender = parent
        ? conversation?.members?.find((m) => m.id === parent.senderId)
        : null;
      const parentName = parent
        ? parent.senderId === me
          ? 'You'
          : conversation?.type === 'group'
            ? parentSender?.displayName || parentSender?.username || 'Member'
            : peerName
        : undefined;

      if (message.type === 'text') {
        return (
          <MessageBubble
            message={message}
            isMe={isMe}
            replyTo={parent}
            replyToName={parentName}
            senderName={senderName}
            onLongPress={() => openActions(message)}
            onRetry={() =>
              message.clientMessageId && retryMsg(conversationId, message.clientMessageId)
            }
            onPressReply={jumpTo}
          />
        );
      }

      return (
        <MediaBubble
          message={message}
          isMe={isMe}
          senderName={senderName}
          onLongPress={() => openActions(message)}
          onRetry={() =>
            message.clientMessageId && retryMsg(conversationId, message.clientMessageId)
          }
        />
      );
    },
    [theme, me, byId, peerName, conversation, openActions, retryMsg, conversationId, jumpTo],
  );

  const isGroup = conversation?.type === 'group';

  let typingSubtitle = '';
  if (peerTyping && conv?.typingUserIds) {
    const typingIds = Array.from(conv.typingUserIds);
    const names = typingIds
      .map((id) => conversation?.members?.find((m) => m.id === id)?.displayName)
      .filter(Boolean);
    if (names.length === 1) typingSubtitle = `${names[0]} is typing…`;
    else if (names.length > 1) typingSubtitle = `${names.length} people typing…`;
    else typingSubtitle = 'typing…';
  }

  const peerSubtitle = typingSubtitle
    ? typingSubtitle
    : isGroup
      ? `${conversation?.members?.length ?? conversation?.participantIds.length ?? 0} members`
      : peer?.isOnline
        ? 'online'
        : peer?.lastSeenAt
          ? `last seen ${new Date(peer.lastSeenAt).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : '';

  const openDetails = () =>
    router.push({ pathname: '/(main)/conversation-settings', params: { conversationId } });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chatBg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.header }}>
        <View style={styles.header}>
          <IconButton
            name="back"
            accessibilityLabel="Back to chats"
            color="headerText"
            diameter={40}
            onPress={() => router.back()}
          />
          <Pressable
            onPress={openDetails}
            accessibilityRole="button"
            accessibilityLabel={`${peerName}. ${peerSubtitle || 'Open conversation details'}`}
            style={styles.headerIdentity}
          >
            <Avatar
              name={peerName}
              uri={peer?.avatarUrl}
              size={38}
              online={peer?.isOnline}
              ringColor={theme.colors.header}
            />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" color="headerText" numberOfLines={1}>
                {peerName}
              </Text>
              {peerSubtitle ? (
                <Text variant="caption" color="headerMuted" numberOfLines={1}>
                  {peerSubtitle}
                </Text>
              ) : null}
            </View>
          </Pressable>
          <IconButton
            name="search"
            accessibilityLabel="Search in conversation"
            color="headerText"
            diameter={40}
            onPress={() =>
              router.push({ pathname: '/(main)/chat-search', params: { conversationId } })
            }
          />
          <IconButton
            name="more"
            accessibilityLabel="Conversation details"
            color="headerText"
            diameter={40}
            onPress={openDetails}
          />
        </View>
      </SafeAreaView>

      <OfflineBanner />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {initialLoading && messages.length === 0 ? (
          <MessageSkeleton />
        ) : (
          <FlashList
            ref={listRef}
            data={rows}
            keyExtractor={(row) => row.key}
            contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8 }}
            keyboardDismissMode="interactive"
            /* Chat layout: newest at the bottom, history loaded upwards. */
            maintainVisibleContentPosition={{
              startRenderingFromBottom: true,
              autoscrollToBottomThreshold: 0.2,
              animateAutoScrollToBottom: !theme.reducedMotion,
            }}
            onStartReached={loadOlder}
            onStartReachedThreshold={0.4}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              const distanceToBottom =
                contentSize.height - contentOffset.y - layoutMeasurement.height;
              setAtBottom(distanceToBottom < 140);
            }}
            scrollEventThrottle={64}
            ListEmptyComponent={
              <View style={{ paddingVertical: 72 }}>
                <Empty
                  icon="message"
                  title="No messages yet"
                  subtitle={`Say hello to ${peerName}.`}
                />
              </View>
            }
            renderItem={renderRow}
          />
        )}

        {peerTyping ? (
          <View style={[styles.typing, { backgroundColor: theme.colors.surfaceElevated }]}>
            <Text variant="caption" color="textMuted" accessibilityLiveRegion="polite">
              {peerName} is typing…
            </Text>
          </View>
        ) : null}

        {!atBottom ? (
          <IconButton
            name="scrollDown"
            accessibilityLabel="Jump to latest messages"
            variant="tinted"
            diameter={40}
            style={styles.jumpButton}
            onPress={() => listRef.current?.scrollToEnd({ animated: !theme.reducedMotion })}
          />
        ) : null}

        <Composer
          value={draft}
          onChangeText={onChangeDraft}
          onSend={submit}
          onAttach={() => setSheet('attachment')}
          onStickers={() => setSheet('sticker')}
          replyTo={replyTo}
          replyToName={replyTo?.senderId === me ? 'yourself' : peerName}
          onCancelReply={() => setReplyTo(null)}
          editing={editing}
          onCancelEdit={() => {
            setEditing(null);
            setDraft('');
          }}
        />
      </KeyboardAvoidingView>

      <AttachmentSheet
        visible={sheet === 'attachment'}
        mode={sheet}
        onClose={() => setSheet('none')}
        onOpenGif={() => setSheet('gif')}
        onOpenSticker={() => setSheet('sticker')}
        conversationId={conversationId}
        replyToId={replyTo?.id ?? null}
      />
      <GifPanel
        visible={sheet === 'gif'}
        onClose={() => setSheet('none')}
        conversationId={conversationId}
        replyToId={replyTo?.id ?? null}
      />
      <StickerPanel
        visible={sheet === 'sticker'}
        onClose={() => setSheet('none')}
        onOpenGif={() => setSheet('gif')}
        conversationId={conversationId}
        replyToId={replyTo?.id ?? null}
      />

      <ActionSheet
        visible={!!selected}
        actions={actions}
        onClose={() => setSelected(null)}
        header={
          selected && !selected.deletedAt && me ? (
            <ReactionPicker
              selected={selected.reactions?.find((r) => r.userId === me)?.emoji ?? null}
              onPick={(emoji) => {
                const target = selected;
                setSelected(null);
                void reactMsg(conversationId, target.id, emoji, me).catch(() =>
                  setActionError('That reaction could not be saved.'),
                );
              }}
            />
          ) : null
        }
      />

      <ConfirmDialog
        visible={!!confirmDelete}
        title="Delete message?"
        message="It will be removed for everyone in this conversation."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target) {
            void removeMsg(conversationId, target.id).catch(() =>
              setActionError('That message could not be deleted.'),
            );
          }
        }}
      />

      <ConfirmDialog
        visible={!!actionError}
        title="Something went wrong"
        message={actionError ?? undefined}
        confirmLabel="OK"
        cancelLabel="Dismiss"
        onConfirm={() => setActionError(null)}
        onCancel={() => setActionError(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  headerIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  separatorWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  typing: {
    position: 'absolute',
    bottom: 68,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  jumpButton: {
    position: 'absolute',
    right: 14,
    bottom: 84,
  },
});
