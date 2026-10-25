import React, { useEffect, useState } from 'react';
import { View, Pressable, Switch, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { notificationsApi, type PushPrefs } from '@/features/notifications/notificationsApi';

export default function NotificationsScreen() {
  const theme = useTheme();
  const [prefs, setPrefs] = useState<PushPrefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    notificationsApi
      .getPrefs()
      .then((p) => {
        if (!cancelled) setPrefs(p);
      })
      .catch(() => {
        if (!cancelled) setPrefs({ enabled: true, showPreview: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = async (patch: Partial<PushPrefs>) => {
    if (!prefs) return;
    const optimistic = { ...prefs, ...patch };
    setPrefs(optimistic);
    setSaving(true);
    try {
      const next = await notificationsApi.setPrefs(patch);
      setPrefs(next);
    } catch (e) {
      setPrefs(prefs);
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) {
    return (
      <Screen padded>
        <ActivityIndicator color={theme.colors.accent} />
      </Screen>
    );
  }

  return (
    <Screen padded>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="h2">Notifications</Text>
          <Text variant="small" color="textMuted">
            Previews are controlled server-side. When off, the push payload says only "New
            message" — the sender's name and content stay off the delivery path.
          </Text>
        </View>

        <Row
          label="Enable notifications"
          value={prefs.enabled}
          onToggle={(v) => update({ enabled: v })}
          disabled={saving}
        />
        <Row
          label="Show message preview"
          value={prefs.showPreview}
          onToggle={(v) => update({ showPreview: v })}
          disabled={saving || !prefs.enabled}
        />
      </View>
    </Screen>
  );
}

const Row: React.FC<{
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
}> = ({ label, value, onToggle, disabled }) => {
  const theme = useTheme();
  return (
    <Pressable
      style={[
        styles.row,
        { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md },
      ]}
      onPress={() => !disabled && onToggle(!value)}
    >
      <Text variant="bodyStrong" style={{ opacity: disabled ? 0.5 : 1 }}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
