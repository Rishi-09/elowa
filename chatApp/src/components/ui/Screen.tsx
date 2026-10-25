import React from 'react';
import { View, type ViewStyle, StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: readonly Edge[];
  padded?: boolean;
};

export const Screen: React.FC<Props> = ({ children, style, edges, padded = false }) => {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={edges ?? ['top', 'bottom']}
      style={[styles.root, { backgroundColor: theme.colors.bg }]}
    >
      <View style={[{ flex: 1, padding: padded ? theme.spacing.lg : 0 }, style]}>{children}</View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({ root: { flex: 1 } });
