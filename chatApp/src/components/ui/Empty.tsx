import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';

type Props = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
};

export const Empty: React.FC<Props> = ({ title, subtitle, icon, actionLabel, onAction }) => {
  const theme = useTheme();
  return (
    <View
      style={{
        padding: theme.spacing.xxl,
        alignItems: 'center',
        gap: theme.spacing.md,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.accentMuted,
          }}
        >
          <Icon name={icon} size="xxl" color="accent" />
        </View>
      ) : null}
      <Text variant="h3" accessibilityRole="header" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="small" color="textMuted" style={{ textAlign: 'center', maxWidth: 320 }}>
          {subtitle}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} size="sm" variant="secondary" onPress={onAction} />
      ) : null}
    </View>
  );
};
