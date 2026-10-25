import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/theme/ThemeProvider';

const LOGO_SOURCE = require('@/assets/logo.png');

type Props = {
  size?: number;
  color?: string;
  showText?: boolean;
  textColor?: string;
};

export const ElowaLogo: React.FC<Props> = ({
  size = 28,
  showText = true,
  textColor,
}) => {
  const theme = useTheme();
  const label = textColor ?? theme.colors.headerText;

  return (
    <View style={styles.container}>
      <View
        accessibilityRole="image"
        accessibilityLabel="Elowa logo"
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.22),
          overflow: 'hidden',
        }}
      >
        <Image
          source={LOGO_SOURCE}
          style={{ width: size, height: size }}
          contentFit="cover"
        />
      </View>
      {showText ? (
        <Text style={[styles.text, { color: label, fontSize: size * 0.85 }]}>
          Elowa
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
