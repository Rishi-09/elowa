import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';
import { Button } from './Button';
import { Icon } from './Icon';

type Props = { title: string; message?: string; onRetry?: () => void };

export const ErrorState: React.FC<Props> = ({ title, message, onRetry }) => {
  const theme = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        padding: theme.spacing.xl,
        gap: theme.spacing.md,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.dangerMuted,
        }}
      >
        <Icon name="warning" size="xl" color="danger" />
      </View>
      <Text variant="h3" accessibilityRole="header" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {message ? (
        <Text variant="small" color="textMuted" style={{ textAlign: 'center', maxWidth: 320 }}>
          {message}
        </Text>
      ) : null}
      {onRetry ? (
        <Button label="Try again" icon="retry" variant="secondary" size="sm" onPress={onRetry} />
      ) : null}
    </View>
  );
};
