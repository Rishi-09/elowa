import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Props = {
  count: number;
  /** Dimmed styling for muted conversations. */
  muted?: boolean;
  max?: number;
};

export const Badge: React.FC<Props> = ({ count, muted, max = 99 }) => {
  const theme = useTheme();
  if (count <= 0) return null;
  const label = count > max ? `${max}+` : String(count);

  return (
    <View
      accessibilityLabel={`${count} unread ${count === 1 ? 'message' : 'messages'}`}
      style={{
        minWidth: 22,
        height: 22,
        borderRadius: theme.radius.pill,
        paddingHorizontal: theme.spacing.xs + 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: muted ? theme.colors.borderStrong : theme.colors.accent,
      }}
    >
      <Text variant="caption" color={muted ? 'text' : 'onAccent'} style={{ fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
};
