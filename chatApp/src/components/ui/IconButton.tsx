import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon, type IconName, type IconProps } from './Icon';

type Props = {
  name: IconName;
  /** Required: icon-only controls must be announced to screen readers. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  size?: IconProps['size'];
  color?: IconProps['color'];
  /** Rendered diameter of the pressable; never below the 44dp touch minimum. */
  diameter?: number;
  variant?: 'plain' | 'filled' | 'tinted';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const IconButton: React.FC<Props> = ({
  name,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  onLongPress,
  size = 'lg',
  color = 'textMuted',
  diameter,
  variant = 'plain',
  disabled,
  style,
}) => {
  const theme = useTheme();
  const dim = Math.max(diameter ?? theme.touch.min, variant === 'plain' ? 0 : theme.touch.min);

  const background =
    variant === 'filled'
      ? theme.colors.accent
      : variant === 'tinted'
        ? theme.colors.accentMuted
        : 'transparent';

  const fg = variant === 'filled' ? 'onAccent' : color;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={theme.touch.slop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: background,
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        },
        variant === 'filled' ? theme.elevation[1] : null,
        style,
      ]}
    >
      <Icon name={name} size={size} color={fg} />
    </Pressable>
  );
};
