import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';

type Props = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Replaces the default chevron (e.g. a Switch or a value label). */
  accessory?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Settings-style row. Non-pressable when `onPress` is omitted. */
export const ListRow: React.FC<Props> = ({
  title,
  subtitle,
  icon,
  accessory,
  onPress,
  destructive,
  disabled,
  style,
}) => {
  const theme = useTheme();

  const content = (
    <>
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: destructive ? theme.colors.dangerMuted : theme.colors.accentMuted,
          }}
        >
          <Icon name={icon} size="md" color={destructive ? 'danger' : 'accent'} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" color={destructive ? 'danger' : 'text'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {accessory ?? (onPress ? <Icon name="chevronRight" size="md" color="textSubtle" /> : null)}
    </>
  );

  const base: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: theme.touch.min + 12,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  };

  if (!onPress) return <View style={[base, style]}>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        base,
        { backgroundColor: pressed ? theme.colors.surface : 'transparent', opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
};

/** Grouped card that holds ListRows with hairline separators. */
export const ListSection: React.FC<{
  title?: string;
  children: React.ReactNode;
  footer?: string;
}> = ({ title, children, footer }) => {
  const theme = useTheme();
  const items = React.Children.toArray(children);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {title ? (
        <Text
          variant="label"
          color="textMuted"
          accessibilityRole="header"
          style={{ paddingHorizontal: theme.spacing.xs, textTransform: 'uppercase', letterSpacing: 0.6 }}
        >
          {title}
        </Text>
      ) : null}
      <View
        style={{
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surfaceElevated,
          borderWidth: 1,
          borderColor: theme.colors.border,
          overflow: 'hidden',
        }}
      >
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 ? (
              <View
                style={{
                  height: 1,
                  marginLeft: theme.spacing.lg,
                  backgroundColor: theme.colors.border,
                }}
              />
            ) : null}
            {child}
          </View>
        ))}
      </View>
      {footer ? (
        <Text variant="small" color="textMuted" style={{ paddingHorizontal: theme.spacing.xs }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
};
