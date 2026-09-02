import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { MobileHeaderLogo, MobileMenuButton } from '../../components/mobile-navigation';
import { useTeamBranding } from '../../lib/team-branding';
const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  three: 'podium',
  trivia: 'help-circle',
  wire: 'flash',
  account: 'person',
};
export default function TabLayout() {
  const router=useRouter();
  const { theme } = useTeamBranding();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: theme.dark },
        headerTintColor: theme.light,
        headerTitleStyle: { fontWeight: '900' },
        headerLeft: () => <MobileMenuButton />,
        headerTitle: () => <MobileHeaderLogo />,
        headerRight:()=> <Pressable accessibilityLabel="Search" onPress={()=>router.push('/search')} style={{paddingHorizontal:18,paddingVertical:10}}><Ionicons name="search" color={theme.light} size={22}/></Pressable>,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: '#667786',
        tabBarStyle: {
          height: 84,
          paddingTop: 8,
          backgroundColor: '#fff',
          borderTopColor: '#e8e1d7',
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '800', paddingBottom: 8 },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={icons[route.name] ?? 'ellipse'} color={color} size={size} />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="three" options={{ title: 'Three & Out', headerTitle: 'Three and Out' }} />
      <Tabs.Screen name="trivia" options={{ title: 'Trivia' }} />
      <Tabs.Screen name="wire" options={{ title: 'The Wire' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
