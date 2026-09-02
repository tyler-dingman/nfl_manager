import { type Href, Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { TeamProvider } from '../lib/team-context';
import { useTeamBranding } from '../lib/team-branding';
import { notificationDestination, syncPushRegistration } from '../lib/push';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <View style={{ flex: 1, backgroundColor: '#081824', justifyContent: 'center' }}>
        <ActivityIndicator color="#FFB81C" />
      </View>
    );
  return (
    <TeamProvider>
      <AuthenticatedStack authenticated={Boolean(user)} />
    </TeamProvider>
  );
}
function AuthenticatedStack({ authenticated }: { authenticated: boolean }) {
  const { theme } = useTeamBranding();
  return (
    <>
      <PushBootstrap />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.dark },
          headerTintColor: theme.light,
          headerTitleStyle: { fontWeight: '900' },
          headerBackTitle: 'Back',
        }}
      >
        <Stack.Protected guard={authenticated}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="story/[id]" options={{ title: 'Story' }} />
          <Stack.Screen name="trivia-game" options={{ title: 'Trivia' }} />
          <Stack.Screen name="catch-up" options={{ title: 'Get Caught Up' }} />
          <Stack.Screen name="team-select" options={{ title: 'My Team' }} />
          <Stack.Screen name="profile" options={{ title: 'Profile' }} />
          <Stack.Screen name="rewards" options={{ title: 'Move the Chains' }} />
          <Stack.Screen name="saved" options={{ title: 'Saved' }} />
          <Stack.Screen name="notification-settings" options={{ title: 'Notifications' }} />
          <Stack.Screen name="search" options={{ title: 'Search' }} />
          <Stack.Screen name="merch" options={{ title: 'Merch' }} />
          <Stack.Screen name="front-office" options={{ title: 'Front Office' }} />
          <Stack.Screen name="game-day" options={{ title: 'Game Day' }} />
          <Stack.Screen name="player/[playerId]" options={{ title: 'Player' }} />
        </Stack.Protected>
        <Stack.Protected guard={!authenticated}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
function PushBootstrap() {
  const router = useRouter();
  useEffect(() => {
    void syncPushRegistration().catch(() => undefined);
    const open = (response: Notifications.NotificationResponse | null) => {
      const destination = notificationDestination(response);
      if (destination) router.push(destination as Href);
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [router]);
  return null;
}
