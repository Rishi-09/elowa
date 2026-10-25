import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ListRow, ListSection } from '@/components/ui/ListRow';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuthStore } from '@/stores/authStore';
import { conversationsApi } from '@/features/conversations/conversationsApi';
import { usersApi } from '@/features/users/usersApi';
import { mediaService, PermissionError } from '@/features/media/mediaService';
import type { Conversation, User } from '@/types';

const DISAPPEARING_OPTIONS: { label: string; seconds: number | null }[] = [
  { label: 'Off', seconds: null },
  { label: '24 hours', seconds: 24 * 60 * 60 },
  { label: '7 days', seconds: 7 * 24 * 60 * 60 },
  { label: '30 days', seconds: 30 * 24 * 60 * 60 },
];

export default function ConversationSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user?.id);
  const { conversationId: raw } = useLocalSearchParams<{ conversationId: string }>();
  const conversationId = String(raw);

  const [conv, setConv] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTtl, setSavingTtl] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Group Admin Edits
  const [editingTitleModal, setEditingTitleModal] = useState(false);
  const [groupTitleInput, setGroupTitleInput] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Member Management
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [memberActionBusy, setMemberActionBusy] = useState(false);

  // Add Member Modal
  const [addMemberModal, setAddMemberModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<User[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Leave Group
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const fetchConv = async () => {
    try {
      const data = await conversationsApi.get(conversationId);
      setConv(data);
      setGroupTitleInput(data.title ?? '');
    } catch (e) {
      setErrorNotice(e instanceof Error ? e.message : 'Could not load conversation details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchConv();
  }, [conversationId]);

  // Search users for Add Member
  useEffect(() => {
    if (!addMemberModal) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedToAdd([]);
      return;
    }
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
        // Exclude users already in conversation
        const filtered = users.filter((u) => !conv?.participantIds.includes(u.id));
        setSearchResults(filtered);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, addMemberModal, conv?.participantIds]);

  if (loading || !conv) {
    return (
      <Screen padded>
        <Loading label="Loading details" />
      </Screen>
    );
  }

  const isGroup = conv.type === 'group';
  const isAdmin = me ? conv.adminIds?.includes(me) : false;
  const peer = conv.peer;

  const handleSelectTtl = async (seconds: number | null) => {
    if (seconds === conv.disappearingTtlSeconds) return;
    setSavingTtl(true);
    try {
      const updated = await conversationsApi.setDisappearing(conversationId, seconds);
      setConv((prev) => (prev ? { ...prev, disappearingTtlSeconds: updated.disappearingTtlSeconds } : prev));
      qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch (e) {
      setErrorNotice(e instanceof Error ? e.message : 'Could not change timer.');
    } finally {
      setSavingTtl(false);
    }
  };

  const handleSaveTitle = async () => {
    const trimmed = groupTitleInput.trim();
    if (!trimmed) {
      setErrorNotice('Group title cannot be empty.');
      return;
    }
    setSavingTitle(true);
    try {
      const updated = await conversationsApi.updateGroup(conversationId, { title: trimmed });
      setConv((prev) => (prev ? { ...prev, title: updated.title, peer: { ...prev.peer, displayName: updated.title ?? '' } } : prev));
      setEditingTitleModal(false);
      qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch (e) {
      setErrorNotice(e instanceof Error ? e.message : 'Could not update group title.');
    } finally {
      setSavingTitle(false);
    }
  };

  const handleChangeAvatar = async () => {
    if (!isAdmin) return;
    setUploadingAvatar(true);
    try {
      const asset = await mediaService.pickFromLibrary();
      if (!asset) return;
      const uploaded = await mediaService.upload(asset);
      const updated = await conversationsApi.updateGroup(conversationId, { avatarUrl: uploaded.url });
      setConv((prev) => (prev ? { ...prev, avatarUrl: updated.avatarUrl, peer: { ...prev.peer, avatarUrl: updated.avatarUrl } } : prev));
      qc.invalidateQueries({ queryKey: ['conversations'] });
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

  const handleToggleAdmin = async (targetUser: User) => {
    const isTargetAdmin = conv.adminIds?.includes(targetUser.id);
    setMemberActionBusy(true);
    try {
      const updated = await conversationsApi.setAdmin(conversationId, targetUser.id, !isTargetAdmin);
      setConv(updated);
      setSelectedMember(null);
      qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch (e) {
      setErrorNotice(e instanceof Error ? e.message : 'Could not modify admin privileges.');
    } finally {
      setMemberActionBusy(false);
    }
  };

  const handleRemoveMember = async (targetUser: User) => {
    setMemberActionBusy(true);
    try {
      const updated = await conversationsApi.removeMember(conversationId, targetUser.id);
      setConv(updated);
      setSelectedMember(null);
      qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch (e) {
      setErrorNotice(e instanceof Error ? e.message : 'Could not remove member.');
    } finally {
      setMemberActionBusy(false);
    }
  };

  const handleAddMembersSubmit = async () => {
    if (selectedToAdd.length === 0) return;
    setAddingMembers(true);
    try {
      const updated = await conversationsApi.addMembers(
        conversationId,
        selectedToAdd.map((u) => u.id),
      );
      setConv(updated);
      setAddMemberModal(false);
      qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch (e) {
      setErrorNotice(e instanceof Error ? e.message : 'Could not add members.');
    } finally {
      setAddingMembers(false);
    }
  };

  const handleLeaveGroup = async () => {
    setLeaving(true);
    try {
      await conversationsApi.leaveGroup(conversationId);
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setConfirmLeave(false);
      router.replace('/(main)/chats');
    } catch (e) {
      setErrorNotice(e instanceof Error ? e.message : 'Could not leave group.');
      setLeaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: isGroup ? 'Group details' : 'Conversation' }} />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header: Direct or Group Identity */}
        <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          {isGroup ? (
            <Pressable
              onPress={handleChangeAvatar}
              disabled={!isAdmin || uploadingAvatar}
              accessibilityRole="button"
              accessibilityLabel={isAdmin ? 'Change group photo' : 'Group photo'}
              style={{ position: 'relative' }}
            >
              <Avatar name={conv.title ?? 'Group'} uri={conv.avatarUrl} size={96} />
              {isAdmin ? (
                <View
                  style={[
                    {
                      position: 'absolute',
                      right: -2,
                      bottom: -2,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: theme.colors.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: theme.colors.bg,
                    },
                    theme.elevation[1],
                  ]}
                >
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color={theme.colors.onAccent} />
                  ) : (
                    <Icon name="camera" size={16} color="onAccent" />
                  )}
                </View>
              ) : null}
            </Pressable>
          ) : (
            <Avatar
              name={peer.displayName || peer.username}
              uri={peer.avatarUrl}
              online={peer.isOnline}
              size={96}
            />
          )}

          {/* Group Title with Admin Edit Pencil */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text variant="h2">{isGroup ? (conv.title ?? 'Group') : (peer.displayName || peer.username)}</Text>
            {isGroup && isAdmin ? (
              <Pressable
                onPress={() => {
                  setGroupTitleInput(conv.title ?? '');
                  setEditingTitleModal(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Edit group name"
                style={{ padding: 4 }}
              >
                <Icon name="edit" size="sm" color="accent" />
              </Pressable>
            ) : null}
          </View>

          {/* Subtitle / Metadata */}
          {isGroup ? (
            <Text variant="small" color="textMuted">
              {conv.members?.length ?? conv.participantIds.length} members · {conv.adminIds?.length ?? 1} admins
            </Text>
          ) : (
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Text variant="small" color="textMuted">
                @{peer.username}
              </Text>
              {peer.bio ? (
                <Text variant="body" color="textSubtle" style={{ textAlign: 'center', marginTop: 4 }}>
                  {peer.bio}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {/* Disappearing Messages Section */}
        <ListSection
          title="Disappearing Messages"
          footer="Messages sent after enabling will expire automatically from both server and local cache."
        >
          {DISAPPEARING_OPTIONS.map((opt) => {
            const active = opt.seconds === conv.disappearingTtlSeconds;
            return (
              <ListRow
                key={opt.label}
                title={opt.label}
                icon="timer"
                onPress={() => handleSelectTtl(opt.seconds)}
                disabled={savingTtl}
                accessory={active ? <Icon name="sent" size="md" color="accent" /> : null}
              />
            );
          })}
        </ListSection>

        {/* Group Member Management */}
        {isGroup ? (
          <ListSection
            title={`Group Members (${conv.members?.length ?? 0})`}
            footer={isAdmin ? 'As an admin, tap a member to manage their role or remove them.' : undefined}
          >
            {isAdmin ? (
              <ListRow
                title="Add members"
                icon="addMember"
                subtitle="Invite more users to this group"
                onPress={() => setAddMemberModal(true)}
              />
            ) : null}

            {conv.members?.map((member) => {
              const isMemberAdmin = conv.adminIds?.includes(member.id);
              const isCurrentUser = member.id === me;
              return (
                <Pressable
                  key={member.id}
                  onPress={() => {
                    if (isAdmin && !isCurrentUser) setSelectedMember(member);
                  }}
                  disabled={!isAdmin || isCurrentUser}
                  style={({ pressed }) => [
                    styles.memberRow,
                    {
                      backgroundColor: pressed ? theme.colors.surface : 'transparent',
                    },
                  ]}
                >
                  <Avatar name={member.displayName} uri={member.avatarUrl} size={42} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">
                      {member.displayName}
                      {isCurrentUser ? ' (You)' : ''}
                    </Text>
                    <Text variant="caption" color="textMuted">
                      @{member.username}
                    </Text>
                  </View>
                  {isMemberAdmin ? (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: theme.radius.sm,
                        backgroundColor: theme.colors.accentMuted,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Icon name="admin" size={13} color="accent" />
                      <Text variant="caption" color="accent" style={{ fontWeight: '600' }}>
                        Admin
                      </Text>
                    </View>
                  ) : isAdmin && !isCurrentUser ? (
                    <Icon name="more" size="sm" color="textSubtle" />
                  ) : null}
                </Pressable>
              );
            })}
          </ListSection>
        ) : null}

        {/* Security Section */}
        <ListSection title="Security">
          <ListRow
            title="Encryption Status"
            subtitle="Protected with TLS/HTTPS/WSS in transit."
            icon="security"
          />
        </ListSection>

        {/* Leave Group Action for Groups */}
        {isGroup ? (
          <ListSection title="Danger Zone">
            <ListRow
              title="Leave group"
              subtitle="You will no longer receive new messages from this group"
              icon="signOut"
              destructive
              onPress={() => setConfirmLeave(true)}
            />
          </ListSection>
        ) : null}
      </ScrollView>

      {/* Edit Group Name Modal */}
      <Modal
        visible={editingTitleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingTitleModal(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}
          onPress={() => setEditingTitleModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.modalBox,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderRadius: theme.radius.xl,
              },
              theme.elevation[3],
            ]}
          >
            <Text variant="h3">Edit group name</Text>
            <Input
              value={groupTitleInput}
              onChangeText={setGroupTitleInput}
              placeholder="Group name"
              maxLength={64}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: 8 }}>
              <Button
                label="Cancel"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => setEditingTitleModal(false)}
              />
              <Button
                label="Save"
                loading={savingTitle}
                style={{ flex: 1 }}
                onPress={handleSaveTitle}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Members Modal */}
      <Modal
        visible={addMemberModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddMemberModal(false)}
      >
        <Screen edges={['top', 'bottom']}>
          <View style={{ padding: theme.spacing.md, gap: theme.spacing.md, flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="h2">Add members</Text>
              <Button
                label="Done"
                size="sm"
                variant="ghost"
                onPress={() => setAddMemberModal(false)}
              />
            </View>

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
                placeholder="Search username"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.searchInput, { color: theme.colors.text }]}
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Icon name="close" size="sm" color="textMuted" />
                </Pressable>
              ) : null}
            </View>

            {/* Selected preview */}
            {selectedToAdd.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text variant="caption" color="textMuted">
                  Selected ({selectedToAdd.length}):
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {selectedToAdd.map((u) => (
                    <Pressable
                      key={u.id}
                      onPress={() => setSelectedToAdd((prev) => prev.filter((m) => m.id !== u.id))}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: theme.radius.pill,
                        backgroundColor: theme.colors.accentMuted,
                      }}
                    >
                      <Text variant="caption" color="accent">
                        {u.displayName}
                      </Text>
                      <Icon name="close" size={12} color="accent" />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* Search list */}
            <View style={{ flex: 1 }}>
              {searching ? (
                <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.accent} />
              ) : (
                <ScrollView contentContainerStyle={{ gap: 4 }}>
                  {searchResults.map((user) => {
                    const isPicked = selectedToAdd.some((u) => u.id === user.id);
                    return (
                      <Pressable
                        key={user.id}
                        onPress={() =>
                          setSelectedToAdd((prev) =>
                            isPicked ? prev.filter((u) => u.id !== user.id) : [...prev, user],
                          )
                        }
                        style={[
                          styles.memberRow,
                          {
                            backgroundColor: isPicked ? theme.colors.accentMuted : 'transparent',
                            borderRadius: theme.radius.md,
                          },
                        ]}
                      >
                        <Avatar name={user.displayName} uri={user.avatarUrl} size={38} />
                        <View style={{ flex: 1 }}>
                          <Text variant="bodyStrong">{user.displayName}</Text>
                          <Text variant="caption" color="textMuted">
                            @{user.username}
                          </Text>
                        </View>
                        <Icon
                          name={isPicked ? 'sent' : 'add'}
                          size="md"
                          color={isPicked ? 'accent' : 'textMuted'}
                        />
                      </Pressable>
                    );
                  })}
                  {searchQuery.trim().length >= 2 && searchResults.length === 0 && !searching ? (
                    <Text variant="small" color="textMuted" style={{ textAlign: 'center', marginTop: 24 }}>
                      No users found.
                    </Text>
                  ) : null}
                </ScrollView>
              )}
            </View>

            {selectedToAdd.length > 0 ? (
              <Button
                label={`Add ${selectedToAdd.length} member${selectedToAdd.length > 1 ? 's' : ''}`}
                loading={addingMembers}
                onPress={handleAddMembersSubmit}
              />
            ) : null}
          </View>
        </Screen>
      </Modal>

      {/* Member Management Actions Dialog */}
      {selectedMember ? (
        <Modal
          visible={!!selectedMember}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedMember(null)}
        >
          <Pressable
            style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}
            onPress={() => setSelectedMember(null)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={[
                styles.modalBox,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  borderRadius: theme.radius.xl,
                },
                theme.elevation[3],
              ]}
            >
              <View style={{ alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Avatar name={selectedMember.displayName} uri={selectedMember.avatarUrl} size={54} />
                <Text variant="h3">{selectedMember.displayName}</Text>
                <Text variant="caption" color="textMuted">
                  @{selectedMember.username}
                </Text>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Button
                  label={
                    conv.adminIds?.includes(selectedMember.id)
                      ? 'Dismiss as admin'
                      : 'Make group admin'
                  }
                  variant="secondary"
                  loading={memberActionBusy}
                  onPress={() => handleToggleAdmin(selectedMember)}
                />
                <Button
                  label="Remove from group"
                  variant="danger"
                  loading={memberActionBusy}
                  onPress={() => handleRemoveMember(selectedMember)}
                />
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={() => setSelectedMember(null)}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* Leave Group Confirmation */}
      <ConfirmDialog
        visible={confirmLeave}
        title="Leave group?"
        message="You will no longer receive new messages from this group. If you are the only admin, admin privileges will automatically transfer to another member."
        confirmLabel="Leave"
        cancelLabel="Cancel"
        destructive
        busy={leaving}
        onConfirm={handleLeaveGroup}
        onCancel={() => setConfirmLeave(false)}
      />

      {/* Error Notice Dialog */}
      <ConfirmDialog
        visible={!!errorNotice}
        title="Error"
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
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    padding: 20,
    gap: 16,
  },
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
});
