import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { typography } from '@/theme';
import type { ThemeColors } from '@/theme/colors';

type Variant = keyof typeof typography;
type ColorKey = keyof ThemeColors;

export type TextProps = RNTextProps & {
  variant?: Variant;
  color?: ColorKey;
};

export const Text: React.FC<TextProps> = ({ variant = 'body', color = 'text', style, ...rest }) => {
  const theme = useTheme();
  const base: TextStyle = {
    ...theme.typography[variant],
    color: theme.colors[color] ?? theme.colors.text,
  };
  return <RNText {...rest} style={[base, style]} />;
};
