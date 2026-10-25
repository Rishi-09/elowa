import React, { forwardRef, useState } from 'react';
import { TextInput, View, StyleSheet, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  icon?: IconName;
  /** Adds a show/hide toggle and manages `secureTextEntry` internally. */
  revealable?: boolean;
};

export const Input = forwardRef<TextInput, Props>(
  ({ label, error, hint, icon, revealable, style, onFocus, onBlur, ...rest }, ref) => {
    const theme = useTheme();
    const [focused, setFocused] = useState(false);
    const [revealed, setRevealed] = useState(false);

    const borderColor = error
      ? theme.colors.danger
      : focused
        ? theme.colors.focus
        : theme.colors.border;

    return (
      <View style={{ gap: theme.spacing.xs }}>
        {label ? (
          <Text variant="label" color="textMuted">
            {label}
          </Text>
        ) : null}
        <View
          style={[
            styles.field,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderColor,
              borderWidth: focused ? 2 : 1,
              borderRadius: theme.radius.md,
              paddingHorizontal: focused ? theme.spacing.md : theme.spacing.md + 1,
            },
          ]}
        >
          {icon ? <Icon name={icon} size="md" color="textSubtle" /> : null}
          <TextInput
            ref={ref}
            placeholderTextColor={theme.colors.textSubtle}
            accessibilityLabel={rest.accessibilityLabel ?? label}
            secureTextEntry={revealable ? !revealed : rest.secureTextEntry}
            {...rest}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[styles.input, { color: theme.colors.text }, style]}
          />
          {revealable ? (
            <IconButton
              name={revealed ? 'hidden' : 'visible'}
              accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
              size="md"
              diameter={32}
              onPress={() => setRevealed((v) => !v)}
            />
          ) : null}
        </View>
        {error ? (
          <Text variant="small" color="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : hint ? (
          <Text variant="small" color="textMuted">
            {hint}
          </Text>
        ) : null}
      </View>
    );
  },
);
Input.displayName = 'Input';

const styles = StyleSheet.create({
  field: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
});
