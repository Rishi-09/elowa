import React from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/IconButton';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
  /** Shown under the close button, e.g. "Alex · 14:02". */
  caption?: string;
};

export const ImageViewer: React.FC<Props> = ({ visible, uri, onClose }) => {
  const { width, height } = useWindowDimensions();
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={theme.reducedMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
        />
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width, height: height - 120 }}
            contentFit="contain"
            transition={theme.reducedMotion ? 0 : theme.motion.base}
            accessibilityLabel="Full screen photo"
          />
        ) : null}
        <SafeAreaView edges={['top']} style={styles.topBar}>
          <IconButton
            name="close"
            accessibilityLabel="Close photo"
            onPress={onClose}
            color="#FFFFFF"
            variant="plain"
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    right: 8,
    zIndex: 1,
  },
});
