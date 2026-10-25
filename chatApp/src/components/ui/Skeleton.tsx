import React, { useEffect } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Placeholder block. Pulses unless the OS asks for reduced motion. */
export const Skeleton: React.FC<Props> = ({ width = '100%', height = 14, radius, style }) => {
  const theme = useTheme();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    if (theme.reducedMotion) {
      pulse.value = 0.7;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [theme.reducedMotion, pulse]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.skeleton,
        },
        animated,
        style,
      ]}
    />
  );
};

/** Chat-list placeholder shown while conversations load for the first time. */
export const ConversationSkeleton: React.FC<{ rows?: number }> = ({ rows = 7 }) => {
  const theme = useTheme();
  return (
    <View accessibilityLabel="Loading conversations" accessibilityRole="progressbar">
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
          }}
        >
          <Skeleton width={52} height={52} radius={26} />
          <View style={{ flex: 1, gap: theme.spacing.sm }}>
            <Skeleton width="45%" height={14} />
            <Skeleton width="70%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
};

/** Message-list placeholder shown while a conversation's history loads. */
export const MessageSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel="Loading messages"
      accessibilityRole="progressbar"
      style={{ padding: theme.spacing.md, gap: theme.spacing.md }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          width={i % 2 === 0 ? '55%' : '42%'}
          height={i % 3 === 0 ? 56 : 34}
          radius={theme.radius.lg}
          style={{ alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end' }}
        />
      ))}
    </View>
  );
};
