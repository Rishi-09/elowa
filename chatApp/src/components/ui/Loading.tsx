import React from 'react';
import { View, ActivityIndicator, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Props = { label?: string; style?: ViewStyle };

export const Loading: React.FC<Props> = ({ label, style }) => {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
      style={[{ padding: theme.spacing.xl, alignItems: 'center', gap: theme.spacing.sm }, style]}
    >
      <ActivityIndicator color={theme.colors.accent} />
      {label ? (
        <Text variant="small" color="textMuted">
          {label}
        </Text>
      ) : null}
    </View>
  );
};
