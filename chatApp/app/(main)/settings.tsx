import React, { useEffect, useState } from 'react';
import { View, ScrollView, Switch, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { ListRow, ListSection } from '@/components/ui/ListRow';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';
import { useAuthStore } from '@/stores/authStore';
import { profileApi } from '@/features/profile/profileApi';
import type { PrivacyPrefs } from '@/types';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const setPrivacyInStore = useAuthStore((s) => s.setPrivacy);

  const [privacy, setPrivacy] = useState<PrivacyPrefs>({
    showPresence: user?.privacy?.showPresence ?? true,
    showReadReceipts: user?.privacy?.showReadReceipts ?? true,
    searchable: user?.privacy?.searchable ?? true,
  });
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    profileApi
      .getPrivacy()
      .then((p) => {
        if (!cancelled) {
          setPrivacy(p);
          setPrivacyInStore(p);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setPrivacyInStore]);

  const updatePrivacy = async (patch: Partial<PrivacyPrefs>) => {
    const next = { ...privacy, ...patch };
    setPrivacy(next);
    setPrivacyInStore(next);
    setSavingPrivacy(true);
    try {
      const saved = await profileApi.setPrivacy(patch);
      setPrivacy(saved);
      setPrivacyInStore(saved);
    } catch (e) {
      setPrivacy(privacy);
      setPrivacyInStore(privacy);
      setErrorNotice(e instanceof Error ? e.message : 'Could not update privacy setting.');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleSelectTheme = (mode: ThemePreference) => {
    theme.setMode(mode);
  };

  return (
    <Screen edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile Card */}
        {user ? (
          <Pressable
            onPress={() => router.push('/(main)/profile')}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                padding: theme.spacing.lg,
                backgroundColor: theme.colors.surfaceElevated,
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.85 : 1,
              },
              theme.elevation[1],
            ]}
          >
            <Avatar name={user.displayName || user.username} uri={user.avatarUrl} size={60} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h3">{user.displayName || user.username}</Text>
              <Text variant="small" color="textMuted">
                @{user.username}
              </Text>
              {user.bio ? (
                <Text variant="caption" color="textSubtle" numberOfLines={1}>
                  {user.bio}
                </Text>
              ) : null}
            </View>
            <Icon name="chevronRight" size="md" color="textSubtle" />
          </Pressable>
        ) : null}

        {/* Privacy Preferences */}
        <ListSection
          title="Privacy"
          footer="Presence is shared only with people who share a conversation with you. Read receipts apply to direct conversations and groups."
        >
          <ListRow
            title="Online Presence"
            subtitle="Show when you are online and your last seen time"
            icon="privacy"
            accessory={
              <Switch
                value={privacy.showPresence}
                onValueChange={(val) => updatePrivacy({ showPresence: val })}
                disabled={savingPrivacy}
                trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
              />
            }
          />
          <ListRow
            title="Read Receipts"
            subtitle="Send delivery and read checks on messages"
            icon="read"
            accessory={
              <Switch
                value={privacy.showReadReceipts}
                onValueChange={(val) => updatePrivacy({ showReadReceipts: val })}
                disabled={savingPrivacy}
                trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
              />
            }
          />
          <ListRow
            title="Discoverable in Search"
            subtitle="Allow others to find you by username"
            icon="search"
            accessory={
              <Switch
                value={privacy.searchable}
                onValueChange={(val) => updatePrivacy({ searchable: val })}
                disabled={savingPrivacy}
                trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
              />
            }
          />
        </ListSection>

        {/* Appearance / Theme */}
        <ListSection title="Appearance" footer="Customize how Elowa looks on your device.">
          <ListRow
            title="Light theme"
            icon="themeLight"
            onPress={() => handleSelectTheme('light')}
            accessory={
              theme.preference === 'light' ? (
                <Icon name="sent" size="md" color="accent" />
              ) : null
            }
          />
          <ListRow
            title="Dark theme"
            icon="themeDark"
            onPress={() => handleSelectTheme('dark')}
            accessory={
              theme.preference === 'dark' ? (
                <Icon name="sent" size="md" color="accent" />
              ) : null
            }
          />
          <ListRow
            title="System default"
            icon="themeSystem"
            subtitle="Matches device system settings"
            onPress={() => handleSelectTheme('system')}
            accessory={
              theme.preference === 'system' ? (
                <Icon name="sent" size="md" color="accent" />
              ) : null
            }
          />
        </ListSection>

        {/* Notifications */}
        <ListSection title="Notifications">
          <ListRow
            title="Push Notifications"
            subtitle="Manage push alerts and message preview content"
            icon="notifications"
            onPress={() => router.push('/(main)/notifications')}
          />
        </ListSection>

        {/* Security Info */}
        <ListSection title="Security & Integrity">
          <ListRow
            title="Transport Encryption"
            subtitle="Encrypted with TLS/HTTPS/WSS in transit. Server storage is isolated and protected."
            icon="security"
          />
        </ListSection>

        {/* Account Actions */}
        <ListSection title="Account">
          <ListRow
            title="Sign out"
            subtitle="Clear active session from this device"
            icon="signOut"
            destructive
            onPress={() => setConfirmSignOut(true)}
          />
        </ListSection>
      </ScrollView>

      {/* Sign Out Confirmation */}
      <ConfirmDialog
        visible={confirmSignOut}
        title="Sign out?"
        message="Your local cached messages and active session will be cleared on this device."
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          setConfirmSignOut(false);
          void signOut();
        }}
        onCancel={() => setConfirmSignOut(false)}
      />

      {/* Error Notice */}
      <ConfirmDialog
        visible={!!errorNotice}
        title="Privacy update failed"
        message={errorNotice ?? undefined}
        confirmLabel="OK"
        cancelLabel="Dismiss"
        onConfirm={() => setErrorNotice(null)}
        onCancel={() => setErrorNotice(null)}
      />
    </Screen>
  );
}
