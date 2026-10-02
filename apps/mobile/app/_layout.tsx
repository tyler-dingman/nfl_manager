import { FrontOfficeNewsToast } from '../components/front-office-news-toast';
import { LaunchAnimation } from '../components/launch-animation';
import { PersonalizationGate } from '../components/personalization-gate';
import { demoSession } from '../lib/demo-session';
import { type Href, Stack, useRouter, usePathname } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, View, Text } from 'react-native';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { TeamProvider } from '../lib/team-context';
import {
  initializeAndroidNotifications,
  notificationDestination,
  subscribeToFcmTokenRefresh,
  syncPushRegistration,
} from '../lib/push';
import { BottomNavigation } from '../components/bottom-navigation';
import { MobileSiteHeader } from '../components/mobile-site-header';
import { CommerceCartProvider } from '../lib/commerce-cart';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BarlowCondensedRegular: require('../assets/fonts/BarlowCondensed-Regular.ttf'),
    BarlowCondensedSemiBold: require('../assets/fonts/BarlowCondensed-SemiBold.ttf'),
    BarlowCondensed: require('../assets/fonts/BarlowCondensed-ExtraBold.ttf'),
    BarlowCondensedItalic: require('../assets/fonts/BarlowCondensed-ExtraBoldItalic.ttf'),
  });
  if (!fontsLoaded && !fontError)
    return (
      <View style={{ flex: 1, backgroundColor: '#001222', justifyContent: 'center' }}>
        <ActivityIndicator color="white" />
      </View>
    );
  return (
    <AuthProvider>
      <LaunchAnimation><RootNavigator /></LaunchAnimation>
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
    <TeamProvider key={user?.id ?? 'signed-out'}>
      <CommerceCartProvider>
        <PersonalizationGate key={user?.id ?? "guest"}><AuthenticatedStack authenticated={Boolean(user)} /></PersonalizationGate>
      </CommerceCartProvider>
    </TeamProvider>
  );
}
function AuthenticatedStack({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname();
  return (
    <View style={{ flex: 1, backgroundColor: '#091A20' }}>
      {authenticated && demoSession.isActive() && (
        <Text
          style={{ color: '#FFB81C', backgroundColor: '#091A20', textAlign: 'center', padding: 4 }}
        >
          PREVIEW · SAMPLE CONTENT
        </Text>
      )}
      <PushBootstrap />
      <Stack
        screenOptions={{
          header: ({ back, navigation, route }) => (
            <MobileSiteHeader
              onBack={
                back && !['front-office', 'parlay-lab', 'film-room', 'beat', 'search'].includes(route.name)
                  ? () => navigation.goBack()
                  : undefined
              }
            />
          ),
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
          <Stack.Screen name="search" options={{ title: 'Search', presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
          <Stack.Screen name="merch" options={{ title: 'Merch' }} />
          <Stack.Screen name="merch-product/[productId]" options={{ title: 'Product' }} />
          <Stack.Screen name="merch-cart" options={{ title: 'Cart' }} />
          <Stack.Screen name="merch-checkout" options={{ title: 'Demo Checkout' }} />
          <Stack.Screen name="orders" options={{ title: 'My Orders' }} />
          <Stack.Screen name="order/[orderId]" options={{ title: 'Order' }} />
          <Stack.Screen
            name="front-office"
            options={{
              title: 'Front Office',
            }}
          />
          <Stack.Screen
            name="parlay-lab"
            options={{
              title: 'Parlay Lab',
            }}
          />
          <Stack.Screen name="game-day" options={{ title: 'Game Day' }} />
          <Stack.Screen name="beat" options={{ title: 'The Beat' }} />
          <Stack.Screen name="beat-story/[id]" options={{ title: 'The Beat' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen
            name="film-room"
            options={{
              title: 'Film Room',
            }}
          />
          <Stack.Screen name="crew" options={{ title: 'The Crew' }} />
          <Stack.Screen name="security" options={{ title: 'Security' }} />
          <Stack.Screen name="player/[playerId]" options={{ title: 'Player' }} />
        </Stack.Protected>
        <Stack.Protected guard={!authenticated}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      {authenticated && pathname !== '/search' && <BottomNavigation />}
      {authenticated && <FrontOfficeNewsToast />}
      <StatusBar style="light" />
    </View>
  );
}
function PushBootstrap() {
  const router = useRouter();
  const { user } = useAuth();
  useEffect(() => {
    if (Platform.OS === 'web' || !user || demoSession.isActive()) return;
    void initializeAndroidNotifications().catch(() => undefined);
    void syncPushRegistration().catch(() => undefined);
    const tokenSubscription = subscribeToFcmTokenRefresh();
    const open = (response: Notifications.NotificationResponse | null) => {
      const destination = notificationDestination(response);
      if (destination) router.push(destination as Href);
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => {
      subscription.remove();
      tokenSubscription?.remove();
    };
  }, [router, user]);
  return null;
}
