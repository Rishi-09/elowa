import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';

export default function MainLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.header },
        headerTitleStyle: { color: theme.colors.headerText, fontWeight: '600', fontSize: 18 },
        headerTintColor: theme.colors.headerText,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Stack.Screen name="chats" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen
        name="chat/[conversationId]"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="conversation-settings"
        options={{ title: 'Conversation', presentation: 'modal' }}
      />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="new-chat" options={{ title: 'New chat', presentation: 'modal' }} />
      <Stack.Screen name="new-group" options={{ title: 'New group', presentation: 'modal' }} />
      <Stack.Screen
        name="chat-search"
        options={{ title: 'Search messages', presentation: 'modal' }}
      />
    </Stack>
  );
}
