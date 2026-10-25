import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter, Stack } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Empty } from '@/components/ui/Empty';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { usersApi } from '@/features/users/usersApi';
import { conversationsApi } from '@/features/conversations/conversationsApi';
import type { User } from '@/types';

export default function NewChatScreen() {
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const users = await usersApi.search(q);
        setResults(users);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const startChat = async (user: User) => {
    setStarting(user.id);
    try {
      const conv = await conversationsApi.create(user.id);
      qc.invalidateQueries({ queryKey: ['conversations'] });
      router.replace(`/(main)/chat/${conv.id}`);
    } catch (e) {
      Alert.alert('Could not start chat', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setStarting(null);
    }
  };

  return (
    <Screen padded>
      <Stack.Screen options={{ title: 'New chat' }} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by username"
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
            borderRadius: theme.radius.md,
            borderColor: theme.colors.border,
          },
        ]}
      />

      <Pressable
        onPress={() => router.push('/(main)/new-group')}
        accessibilityRole="button"
        accessibilityLabel="Create a new group"
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed ? theme.colors.surface : theme.colors.surfaceElevated,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            marginBottom: 12,
          },
        ]}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.colors.accentMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="newGroup" size="md" color="accent" />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="bodyStrong">New group</Text>
          <Text variant="caption" color="textMuted">
            Create a group chat with multiple people
          </Text>
        </View>
        <Icon name="chevronRight" size="md" color="textSubtle" />
      </Pressable>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={theme.colors.accent} />
      ) : query.trim().length < 2 ? (
        <Empty title="Find someone" subtitle="Type at least two characters to search." />
      ) : (
        <FlashList
          data={results}
          keyExtractor={(u) => u.id}
          ListEmptyComponent={<Empty title="No matches" />}
          renderItem={({ item }) => {
            const busy = starting === item.id;
            return (
              <Pressable
                onPress={() => startChat(item)}
                disabled={!!starting}
                accessibilityRole="button"
                accessibilityLabel={`Start chat with ${item.displayName}`}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: pressed ? theme.colors.surface : 'transparent',
                    opacity: starting && !busy ? 0.5 : 1,
                  },
                ]}
              >
                <Avatar name={item.displayName} uri={item.avatarUrl} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{item.displayName}</Text>
                  <Text variant="small" color="textMuted">
                    @{item.username}
                  </Text>
                </View>
                {busy ? <ActivityIndicator color={theme.colors.accent} /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
});
