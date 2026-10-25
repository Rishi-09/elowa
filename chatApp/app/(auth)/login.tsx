import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/features/auth/authApi';
import { ApiError } from '@/services/api';
import { ElowaLogo } from '@/components/ui/ElowaLogo';

export default function LoginScreen() {
  const theme = useTheme();
  const setSession = useAuthStore((s) => s.setSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = username.trim().length >= 3 && password.length >= 6 && !loading;

  const onSubmit = async () => {
    setLoading(true);
    try {
      const session = await authApi.login({ username: username.trim(), password });
      await setSession(session);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Something went wrong';
      Alert.alert('Sign in failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <ElowaLogo size={48} color={theme.colors.accent} textColor={theme.colors.text} />
            <Text variant="small" color="textMuted" style={{ marginTop: 4 }}>
              Say More
            </Text>
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="h1">Welcome back</Text>
            <Text variant="body" color="textMuted">
              Sign in to continue your conversations.
            </Text>
          </View>

          <View style={{ gap: theme.spacing.md }}>
            <Input
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="your_username"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />
          </View>

          <Button label="Sign in" onPress={onSubmit} disabled={!canSubmit} loading={loading} />

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            <Text color="textMuted">New here?</Text>
            <Link href="/(auth)/register">
              <Text color="accent" variant="bodyStrong">
                Create an account
              </Text>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
