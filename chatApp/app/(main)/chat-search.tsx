import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Empty } from '@/components/ui/Empty';
import { Loading } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { messagesApi } from '@/features/messages/messagesApi';
import { useAuthStore } from '@/stores/authStore';
import { dayLabel } from '@/features/chat/chatRows';
import type { Message } from '@/types';

const MIN_QUERY = 2;
const DEBOUNCE_MS = 280;

export default function ChatSearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const me = useAuthStore((s) => s.user?.id);
  const { conversationId: raw } = useLocalSearchParams<{ conversationId: string }>();
  const conversationId = String(raw);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setResults([]);
      setState('idle');
      return;
    }
    setState('loading');
    debounce.current = setTimeout(async () => {
      try {
        setResults(await messagesApi.search(conversationId, q));
        setState('ready');
      } catch {
        setState('error');
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, conversationId]);

  return (
    <Screen padded edges={['bottom']}>
      <Stack.Screen options={{ title: 'Search messages' }} />
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search this conversation"
          label="Search"
          icon="search"
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
        />

        {state === 'loading' ? (
          <Loading label="Searching" />
        ) : state === 'error' ? (
          <ErrorState
            title="Search failed"
            message="Check your connection and try again."
            onRetry={() => setQuery((q) => q)}
          />
        ) : state === 'idle' ? (
          <Empty
            icon="search"
            title="Find a message"
            subtitle={`Type at least ${MIN_QUERY} characters to search this conversation.`}
          />
        ) : (
          <FlashList
            data={results}
            keyExtractor={(m) => m.id}
            ListEmptyComponent={
              <Empty icon="search" title="No matches" subtitle="Try a different word." />
            }
            ItemSeparatorComponent={() => (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border }} />
            )}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.replace({
                    pathname: '/(main)/chat/[conversationId]',
                    params: { conversationId, highlight: item.id },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Message from ${
                  item.senderId === me ? 'you' : 'them'
                }: ${item.body ?? ''}`}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? theme.colors.surface : 'transparent' },
                ]}
              >
                <View style={{ flex: 1, gap: 3 }}>
                  <Text variant="small" color="accent">
                    {item.senderId === me ? 'You' : 'Them'} ·{' '}
                    {dayLabel(item.createdAt)}
                  </Text>
                  <Text numberOfLines={2}>{item.body}</Text>
                </View>
                <Icon name="chevronRight" size="md" color="textSubtle" />
              </Pressable>
            )}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
});
