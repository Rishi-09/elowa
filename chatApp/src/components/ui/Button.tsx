import React from 'react';
import { Pressable, ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import type { ThemeColors } from '@/theme/colors';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  /** Defaults to `label`; set when the label alone is ambiguous out of context. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const fgMap: Record<Variant, keyof ThemeColors> = {
  primary: 'onAccent',
  secondary: 'text',
  ghost: 'accent',
  danger: 'onAccent',
};

export const Button: React.FC<Props> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  loading,
  accessibilityLabel,
  accessibilityHint,
  style,
}) => {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const bg = {
    primary: theme.colors.accent,
    secondary: theme.colors.surfaceElevated,
    ghost: 'transparent',
    danger: theme.colors.danger,
  }[variant];

  const fg = fgMap[variant];
  const height = size === 'sm' ? 40 : 52;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        {
          height,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: size === 'sm' ? theme.spacing.lg : theme.spacing.xl,
          backgroundColor: bg,
          borderRadius: theme.radius.lg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: theme.colors.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        variant === 'primary' || variant === 'danger' ? theme.elevation[1] : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors[fg]} />
      ) : (
        <>
          {icon ? (
            <View>
              <Icon name={icon} size={size === 'sm' ? 'sm' : 'md'} color={fg} />
            </View>
          ) : null}
          <Text variant="bodyStrong" color={fg}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
};
