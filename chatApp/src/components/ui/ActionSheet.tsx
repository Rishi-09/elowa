import React from 'react';
import { Modal, Pressable, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';

export type SheetAction = {
  key: string;
  label: string;
  icon: IconName;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
  /** Optional content rendered above the actions (e.g. an emoji reaction row). */
  header?: React.ReactNode;
};

/** Bottom sheet of labelled actions — the app's single context-menu pattern. */
export const ActionSheet: React.FC<Props> = ({ visible, title, actions, onClose, header }) => {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss menu"
        style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' }}
      >
        <Pressable onPress={(e) => e.stopPropagation()} accessibilityViewIsModal>
          <SafeAreaView
            edges={['bottom']}
            style={[
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderTopLeftRadius: theme.radius.xxl,
                borderTopRightRadius: theme.radius.xxl,
                paddingTop: theme.spacing.sm,
              },
              theme.elevation[3],
            ]}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.colors.border,
                marginBottom: theme.spacing.sm,
              }}
            />
            {title ? (
              <Text
                variant="label"
                color="textMuted"
                accessibilityRole="header"
                style={{ paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.sm }}
              >
                {title}
              </Text>
            ) : null}
            {header}
            <ScrollView bounces={false} style={{ maxHeight: 420 }}>
              {actions.map((action) => (
                <Pressable
                  key={action.key}
                  onPress={() => {
                    onClose();
                    action.onPress();
                  }}
                  disabled={action.disabled}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  accessibilityState={{ disabled: !!action.disabled }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.lg,
                    minHeight: theme.touch.min + 6,
                    paddingHorizontal: theme.spacing.xl,
                    backgroundColor: pressed ? theme.colors.surface : 'transparent',
                    opacity: action.disabled ? 0.4 : 1,
                  })}
                >
                  <Icon
                    name={action.icon}
                    size="md"
                    color={action.destructive ? 'danger' : 'textMuted'}
                  />
                  <Text variant="body" color={action.destructive ? 'danger' : 'text'}>
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
