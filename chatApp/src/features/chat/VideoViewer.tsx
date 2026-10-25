import React from 'react';
import { Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { IconButton } from '@/components/ui/IconButton';
import { useTheme } from '@/theme/ThemeProvider';
import { mediaSource } from '@/features/media/mediaSource';

type Props = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
};

/**
 * Full-screen player with the platform's own controls. Private media served
 * from our API needs the session header, which `mediaSource` attaches.
 */
export const VideoViewer: React.FC<Props> = ({ visible, uri, onClose }) => {
  const { width, height } = useWindowDimensions();
  const theme = useTheme();
  const source = mediaSource(uri);

  const player = useVideoPlayer(
    source ? { uri: source.uri as string, headers: source.headers } : null,
    (p) => {
      p.loop = false;
    },
  );

  /* Only play while the viewer is actually on screen. */
  React.useEffect(() => {
    if (!visible) {
      player.pause();
      return;
    }
    player.play();
  }, [visible, player]);

  return (
    <Modal
      visible={visible}
      animationType={theme.reducedMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <VideoView
          player={player}
          style={{ width, height: height - 120 }}
          contentFit="contain"
          nativeControls
          fullscreenOptions={{ enable: true }}
          allowsPictureInPicture={false}
        />
        <SafeAreaView edges={['top']} style={styles.topBar}>
          <IconButton
            name="close"
            accessibilityLabel="Close video"
            onPress={onClose}
            color="#FFFFFF"
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
  topBar: { position: 'absolute', top: 0, right: 8, zIndex: 1 },
});
