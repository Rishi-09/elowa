import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';
import { Icon } from './Icon';

type Props = {
  uri?: string | null;
  name: string;
  size?: number;
  online?: boolean;
  /** Renders a group glyph instead of initials when there is no image. */
  group?: boolean;
  /** Background for the presence dot's ring; match the surface behind it. */
  ringColor?: string;
};

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

export const Avatar: React.FC<Props> = ({ uri, name, size = 44, online, group, ringColor }) => {
  const theme = useTheme();
  const dim = { width: size, height: size, borderRadius: size / 2 };
  const label = initials(name);

  return (
    <View style={{ position: 'relative' }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={dim}
          contentFit="cover"
          transition={theme.reducedMotion ? 0 : theme.motion.fast}
          accessibilityLabel={`${name} profile photo`}
        />
      ) : (
        <View style={[dim, styles.fallback, { backgroundColor: theme.colors.accentMuted }]}>
          {group || !label ? (
            <Icon name={group ? 'group' : 'profile'} size={Math.round(size * 0.46)} color="accent" />
          ) : (
            <Text
              variant="bodyStrong"
              color="accent"
              style={{ fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.44) }}
            >
              {label}
            </Text>
          )}
        </View>
      )}
      {online ? (
        <View
          accessibilityLabel={`${name} is online`}
          style={[
            styles.dot,
            {
              backgroundColor: theme.colors.online,
              borderColor: ringColor ?? theme.colors.bg,
              width: Math.max(10, size * 0.26),
              height: Math.max(10, size * 0.26),
              borderRadius: Math.max(5, size * 0.13),
            },
          ]}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderWidth: 2,
  },
});
