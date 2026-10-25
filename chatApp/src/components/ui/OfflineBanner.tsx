import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';
import { Icon } from './Icon';
import { socketClient } from '@/services/socket';

export const OfflineBanner: React.FC = () => {
  const theme = useTheme();
  const [status, setStatus] = useState(socketClient.getStatus());
  const opacity = useSharedValue(0);
  const translate = useSharedValue(-20);

  useEffect(() => socketClient.onStatus(setStatus), []);

  useEffect(() => {
    const visible = status !== 'connected';
    const duration = theme.reducedMotion ? 0 : theme.motion.base;
    opacity.value = withTiming(visible ? 1 : 0, { duration });
    translate.value = withTiming(visible ? 0 : -20, { duration });
  }, [status, opacity, translate, theme.reducedMotion, theme.motion.base]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translate.value }],
  }));

  const connecting = status === 'connecting';
  const label = connecting ? 'Reconnecting…' : 'No connection';

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
      style={[
        styles.wrap,
        {
          backgroundColor: theme.colors.surfaceElevated,
          borderColor: theme.colors.border,
        },
        theme.elevation[2],
        style,
      ]}
    >
      <View style={styles.row}>
        <Icon name={connecting ? 'retry' : 'offline'} size="sm" color="textMuted" />
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
