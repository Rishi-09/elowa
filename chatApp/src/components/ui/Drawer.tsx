import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type WithTimingConfig,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Fraction of screen width the panel occupies, capped so it never fills a tablet. */
  widthRatio?: number;
  maxWidth?: number;
  accessibilityLabel?: string;
};

/* Closing past this fraction of the panel, or flicking left faster than the
   velocity cut-off, dismisses instead of springing back. */
const CLOSE_DISTANCE_RATIO = 0.4;
const CLOSE_VELOCITY = -550;

/**
 * Left-edge panel that slides in over the current screen with a dimming scrim.
 *
 * Mounts through a Modal so it covers the header and picks up the Android back
 * button, but animates itself rather than using Modal's own transition, which
 * only offers a bottom slide.
 */
export const Drawer: React.FC<Props> = ({
  visible,
  onClose,
  children,
  widthRatio = 0.82,
  maxWidth = 360,
  accessibilityLabel = 'Navigation menu',
}) => {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth * widthRatio, maxWidth);

  /* Kept mounted until the closing animation finishes, otherwise the panel
     would vanish instantly instead of sliding back out. */
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  const timing: WithTimingConfig = { duration: theme.reducedMotion ? 0 : theme.motion.base };

  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, timing);
    } else if (mounted) {
      progress.value = withTiming(0, timing, (finished) => {
        if (finished) runOnJS(unmount)();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-width, 0]) }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  /* Drag the panel left to dismiss; the scrim fades with the same progress so
     the gesture feels continuous rather than snapping at release. */
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      const next = 1 + e.translationX / width;
      progress.value = Math.min(1, Math.max(0, next));
    })
    .onEnd((e) => {
      const shouldClose =
        progress.value < 1 - CLOSE_DISTANCE_RATIO || e.velocityX < CLOSE_VELOCITY;
      if (shouldClose) {
        progress.value = withTiming(0, timing, (finished) => {
          if (finished) {
            runOnJS(unmount)();
            runOnJS(onClose)();
          }
        });
      } else {
        progress.value = withTiming(1, timing);
      }
    });

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.colors.overlay },
            scrimStyle,
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            onPress={onClose}
          />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel}
            style={[
              styles.panel,
              {
                width,
                backgroundColor: theme.colors.bg,
                borderRightColor: theme.colors.border,
              },
              theme.elevation[3],
              panelStyle,
            ]}
          >
            <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
              {children}
            </SafeAreaView>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
});
