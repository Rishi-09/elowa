import React, { useEffect, useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Loading } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/theme/ThemeProvider';
import { profileApi } from '@/features/profile/profileApi';
import { mediaService, PermissionError } from '@/features/media/mediaService';

const MAX_BIO = 240;
const MAX_NAME = 48;

export default function ProfileScreen() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  /* The restored session carries only an id until the profile lands. */
  useEffect(() => {
    if (!user?.username) void refreshProfile();
  }, [user?.username, refreshProfile]);

  useEffect(() => {
    if (!user) return;
    setDisplayName((current) => (current ? current : user.displayName));
    setBio((current) => (current ? current : (user.bio ?? '')));
  }, [user]);

  if (!user) {
    return (
      <Screen padded>
        <Loading label="Loading profile" />
      </Screen>
    );
  }

  const trimmedName = displayName.trim();
  const dirty = trimmedName !== user.displayName || (bio ?? '') !== (user.bio ?? '');

  const save = async () => {
    if (!trimmedName) {
      setNameError('A display name is required.');
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      const updated = await profileApi.update({
        displayName: trimmedName,
        bio: bio.trim() ? bio.trim() : null,
      });
      setUser(updated);
      setNotice('Profile saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  /** Avatars go through the same signed upload path as message attachments. */
  const changeAvatar = async () => {
    setUploading(true);
    try {
      const asset = await mediaService.pickFromLibrary();
      if (!asset) return;
      const uploaded = await mediaService.upload(asset);
      const updated = await profileApi.update({ avatarUrl: uploaded.url });
      setUser(updated);
    } catch (e) {
      setError(
        e instanceof PermissionError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Could not update your photo.',
      );
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    setUploading(true);
    try {
      setUser(await profileApi.update({ avatarUrl: null }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove your photo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Profile' }} />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <Pressable
            onPress={changeAvatar}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={{ opacity: uploading ? 0.6 : 1 }}
          >
            <Avatar name={user.displayName || user.username} uri={user.avatarUrl} size={112} />
            <View
              style={[
                {
                  position: 'absolute',
                  right: -2,
                  bottom: -2,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.accent,
                  borderWidth: 2,
                  borderColor: theme.colors.bg,
                },
                theme.elevation[1],
              ]}
            >
              <Icon name="camera" size="sm" color="onAccent" />
            </View>
          </Pressable>

          {uploading ? <Loading label="Updating photo" /> : null}

          <Text variant="h2">{user.displayName || user.username}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="username" size="sm" color="textMuted" />
            <Text variant="body" color="textMuted">
              {user.username}
            </Text>
          </View>
          {user.avatarUrl ? (
            <Button
              label="Remove photo"
              variant="ghost"
              size="sm"
              icon="delete"
              onPress={removeAvatar}
              disabled={uploading}
            />
          ) : null}
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <Input
            label="Display name"
            value={displayName}
            onChangeText={(t) => {
              setDisplayName(t);
              setNameError(null);
            }}
            maxLength={MAX_NAME}
            error={nameError ?? undefined}
            hint="Shown to people you chat with."
            autoCapitalize="words"
          />
          <Input
            label="Bio"
            value={bio}
            onChangeText={setBio}
            maxLength={MAX_BIO}
            multiline
            hint={`${bio.length}/${MAX_BIO}`}
            style={{ minHeight: 88, textAlignVertical: 'top' }}
          />
          <Input
            label="Username"
            value={user.username}
            editable={false}
            icon="username"
            hint="Usernames cannot be changed."
          />
        </View>

        <Button
          label="Save changes"
          icon="sent"
          onPress={save}
          loading={saving}
          disabled={!dirty}
        />
      </ScrollView>

      <ConfirmDialog
        visible={!!error}
        title="Could not save"
        message={error ?? undefined}
        confirmLabel="OK"
        cancelLabel="Dismiss"
        onConfirm={() => setError(null)}
        onCancel={() => setError(null)}
      />
      <ConfirmDialog
        visible={!!notice}
        title="Saved"
        message={notice ?? undefined}
        confirmLabel="OK"
        cancelLabel="Dismiss"
        onConfirm={() => setNotice(null)}
        onCancel={() => setNotice(null)}
      />
    </Screen>
  );
}
