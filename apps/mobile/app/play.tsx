import { router, Stack } from 'expo-router';
import { View, Text } from 'react-native';
import { PageScrollView } from '../components/page-scroll-view';
import { PlayNavigation } from '../components/play-navigation';

export default function Play() {
  return (
    <PageScrollView
      style={{ backgroundColor: '#081824' }}
      contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
    >
      <Stack.Screen options={{ title: 'Play' }} />
      <Text
        accessibilityRole="header"
        style={{ color: 'white', fontSize: 32, fontFamily: 'BarlowCondensed', marginBottom: 20 }}
      >
        Play
      </Text>
      <View>
        <PlayNavigation navigate={(href) => router.push(href)} />
      </View>
    </PageScrollView>
  );
}
