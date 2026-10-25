import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Drawer } from '@/components/ui/Drawer';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuthStore } from '@/stores/authStore';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type Entry = {
  key: string;
  label: string;
  icon: IconName;
  route: string;
};

const ENTRIES: Entry[] = [
  { key: 'new-group', label: 'New group', icon: 'newGroup', route: '/(main)/new-group' },
  { key: 'profile', label: 'Profile', icon: 'profile', route: '/(main)/profile' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications', route: '/(main)/notifications' },
  { key: 'settings', label: 'Settings', icon: 'settings', route: '/(main)/settings' },
];

/**
 * The chats-screen sidebar. Replaces pushing Settings as a full screen, which
 * gave the hamburger no sense of direction.
 */
export const AppDrawer: React.FC<Props> = ({ visible, onClose }) => {
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  /* Close first so the panel slides out while the next screen pushes in,
     rather than leaving the drawer stacked over it. */
  const go = (route: string) => {
    onClose();
    router.push(route as Parameters<typeof router.push>[0]);
  };

  return (
    <Drawer visible={visible} onClose={onClose}>
      <Pressable
        onPress={() => go('/(main)/profile')}
        accessibilityRole="button"
        accessibilityLabel={`Open your profile, ${user?.displayName ?? ''}`}
        style={({ pressed }) => [
          styles.identity,
          {
            backgroundColor: pressed ? theme.colors.surface : theme.colors.header,
          },
        ]}
      >
        <Avatar
          name={user?.displayName || user?.username || 'You'}
          uri={user?.avatarUrl}
          size={56}
          ringColor={theme.colors.header}
        />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" color="headerText" numberOfLines={1}>
            {user?.displayName || 'You'}
          </Text>
          {user?.username ? (
            <Text variant="small" color="headerMuted" numberOfLines={1}>
              @{user.username}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <ScrollView contentContainerStyle={{ paddingVertical: theme.spacing.sm }}>
        {ENTRIES.map((entry) => (
          <Pressable
            key={entry.key}
            onPress={() => go(entry.route)}
            accessibilityRole="button"
            accessibilityLabel={entry.label}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: pressed ? theme.colors.surface : 'transparent' },
            ]}
          >
            <Icon name={entry.icon} size="lg" color="textMuted" />
            <Text variant="body">{entry.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Drawer>
  );
};

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
});
