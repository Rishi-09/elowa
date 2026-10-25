import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Slot, SplashScreen, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { useAuthStore } from '@/stores/authStore';
import { socketClient } from '@/services/socket';
import { expirySweeper } from '@/features/privacy/expirySweeper';
import { localCache } from '@/services/localCache';
import { notificationService } from '@/features/notifications/notificationService';
import { useMessageStore } from '@/stores/messageStore';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function AuthGate() {
  const status = useAuthStore((s) => s.status);
  const restore = useAuthStore((s) => s.restore);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    restore();
  }, [restore]);

  useEffect(() => {
    if (status === 'loading') return;
    SplashScreen.hideAsync().catch(() => {});
    const inAuth = segments[0] === '(auth)';
    if (status === 'unauthenticated' && !inAuth) {
      router.replace('/(auth)/login');
    } else if (status === 'authenticated' && inAuth) {
      router.replace('/(main)/chats');
    }
  }, [status, segments, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      /* Reload anything that was still unsent when the app last closed, then
         connect: the socket client flushes the outbox once it is up. */
      void useMessageStore.getState().hydratePending();
      socketClient.connect();
      expirySweeper.start();
      notificationService.attachListeners();
      notificationService.registerForPushNotifications().catch(() => {});
    } else {
      socketClient.disconnect();
      expirySweeper.stop();
      notificationService.detachListeners();
      if (status === 'unauthenticated') {
        localCache.clearAll().catch(() => {});
      }
    }
  }, [status]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            {/* Every screen's top inset sits on the navy header, in both themes. */}
            <StatusBar style="light" />
            <AuthGate />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
