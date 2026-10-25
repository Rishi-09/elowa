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

/* Bubble shapes, fixed rather than random so the placeholder does not reflow
   between renders. Widths are a fraction of the row, alignment mirrors the
   in/out split of real messages. */
const BUBBLES: { width: `${number}%`; height: number; mine: boolean }[] = [
  { width: '52%', height: 38, mine: false },
  { width: '38%', height: 34, mine: true },
  { width: '64%', height: 56, mine: false },
  { width: '46%', height: 34, mine: true },
  { width: '58%', height: 34, mine: false },
  { width: '70%', height: 56, mine: true },
  { width: '42%', height: 34, mine: false },
  { width: '50%', height: 38, mine: true },
  { width: '60%', height: 34, mine: false },
  { width: '44%', height: 34, mine: true },
];

/**
 * Message-list placeholder shown while a conversation's history loads.
 *
 * Fills the list area and anchors to the bottom, matching where real messages
 * sit. Anchoring to the top instead left a half-empty screen that read as a
 * keyboard-sized gap when no keyboard was open.
 */
export const MessageSkeleton: React.FC<{ rows?: number }> = ({ rows = BUBBLES.length }) => {
  const theme = useTheme();
  const shapes = BUBBLES.slice(-rows);
  return (
    <View
      accessibilityLabel="Loading messages"
      accessibilityRole="progressbar"
      style={{
        flex: 1,
        justifyContent: 'flex-end',
        padding: theme.spacing.md,
        gap: theme.spacing.md,
      }}
    >
      {shapes.map((b, i) => (
        <Skeleton
          key={i}
          width={b.width}
          height={b.height}
          radius={theme.radius.lg}
          style={{ alignSelf: b.mine ? 'flex-end' : 'flex-start' }}
        />
      ))}
    </View>
  );
};
