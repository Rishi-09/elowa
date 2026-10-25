import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter, Stack } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { Empty } from '@/components/ui/Empty';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTheme } from '@/theme/ThemeProvider';
import { usersApi } from '@/features/users/usersApi';
import { conversationsApi } from '@/features/conversations/conversationsApi';
import { mediaService, PermissionError } from '@/features/media/mediaService';
import type { User } from '@/types';

const MAX_TITLE = 64;

export default function NewGroupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const users = await usersApi.search(q);
        setSearchResults(users);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const toggleMember = (user: User) => {
    setSelectedMembers((prev) => {
      const exists = prev.some((m) => m.id === user.id);
      if (exists) {
        return prev.filter((m) => m.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const pickGroupAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const asset = await mediaService.pickFromLibrary();
      if (!asset) return;
      const uploaded = await mediaService.upload(asset);
      setAvatarUrl(uploaded.url);
    } catch (e) {
      setErrorNotice(
        e instanceof PermissionError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Could not upload group avatar.',
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const createGroup = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorNotice('Please provide a name for the group.');
      return;
    }
    if (selectedMembers.length === 0) {
      setErrorNotice('Select at least one member to add to the group.');
      return;
    }

    setCreating(true);
    try {
      const conv = await conversationsApi.createGroup(
        trimmedTitle,
        selectedMembers.map((m) => m.id),
      );
      if (avatarUrl) {
        await conversationsApi.updateGroup(conv.id, { avatarUrl }).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ['conversations'] });
      router.replace(`/(main)/chat/${conv.id}`);
    } catch (e) {
      setErrorNotice(e instanceof Error ? e.message : 'Could not create group.');
      setCreating(false);
    }
  };

  const canCreate = title.trim().length > 0 && selectedMembers.length > 0 && !creating;

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'New group',
          headerRight: () => (
            <Button
              label="Create"
              size="sm"
              disabled={!canCreate}
              loading={creating}
              onPress={createGroup}
            />
          ),
        }}
      />

      <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
        {/* Top: Avatar + Group Name Input */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Pressable
            onPress={pickGroupAvatar}
            disabled={uploadingAvatar}
            accessibilityRole="button"
            accessibilityLabel="Pick group photo"
            style={{ position: 'relative' }}
          >
            <Avatar name={title || 'Group'} uri={avatarUrl} size={64} />
            <View
              style={[
                {
                  position: 'absolute',
                  right: -2,
                  bottom: -2,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: theme.colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: theme.colors.bg,
                },
                theme.elevation[1],
              ]}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={theme.colors.onAccent} />
              ) : (
                <Icon name="camera" size={13} color="onAccent" />
              )}
            </View>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="Group name"
              maxLength={MAX_TITLE}
              autoFocus
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Selected Members Chips */}
        {selectedMembers.length > 0 ? (
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="caption" color="textMuted">
              Members ({selectedMembers.length})
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: 4 }}
            >
              {selectedMembers.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => toggleMember(m)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${m.displayName}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingLeft: 4,
                    paddingRight: 8,
                    paddingVertical: 4,
                    borderRadius: theme.radius.pill,
                    backgroundColor: theme.colors.surfaceElevated,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  }}
                >
                  <Avatar name={m.displayName} uri={m.avatarUrl} size={22} />
                  <Text variant="small" numberOfLines={1} style={{ maxWidth: 100 }}>
                    {m.displayName}
                  </Text>
                  <Icon name="close" size={14} color="textMuted" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Search Input for Members */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Icon name="search" size="md" color="textMuted" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search users to add"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.searchInput, { color: theme.colors.text }]}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} accessibilityLabel="Clear search">
              <Icon name="close" size="sm" color="textMuted" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Results List */}
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.md }}>
        {searching ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.accent} />
        ) : searchQuery.trim().length < 2 && selectedMembers.length === 0 ? (
          <Empty
            icon="group"
            title="Add members"
            subtitle="Search by username to add friends to this group."
          />
        ) : (
          <FlashList
            data={searchResults}
            keyExtractor={(u) => u.id}
            ListEmptyComponent={
              searchQuery.trim().length >= 2 ? (
                <Empty icon="search" title="No users found" subtitle="Try searching a different username." />
              ) : null
            }
            renderItem={({ item }) => {
              const isSelected = selectedMembers.some((m) => m.id === item.id);
              return (
                <Pressable
                  onPress={() => toggleMember(item)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${item.displayName}, @${item.username}`}
                  style={({ pressed }) => [
                    styles.userRow,
                    {
                      backgroundColor: pressed
                        ? theme.colors.surface
                        : isSelected
                          ? theme.colors.accentMuted
                          : 'transparent',
                      borderRadius: theme.radius.md,
                    },
                  ]}
                >
                  <Avatar name={item.displayName} uri={item.avatarUrl} size={42} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text variant="bodyStrong">{item.displayName}</Text>
                    <Text variant="caption" color="textMuted">
                      @{item.username}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: isSelected ? 0 : 2,
                      borderColor: theme.colors.border,
                      backgroundColor: isSelected ? theme.colors.accent : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSelected ? <Icon name="sent" size={14} color="onAccent" /> : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      {/* Error dialog */}
      <ConfirmDialog
        visible={!!errorNotice}
        title="Group Creation"
        message={errorNotice ?? undefined}
        confirmLabel="OK"
        cancelLabel="Dismiss"
        onConfirm={() => setErrorNotice(null)}
        onCancel={() => setErrorNotice(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginVertical: 2,
  },
});
