import { Ionicons } from '@expo/vector-icons';
import { type Href, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PLAY_EXPERIENCES } from '../../../packages/navigation/play';
import { useTeamBranding } from '../lib/team-branding';

export function PlayNavigation({ navigate }: { navigate: (href: Href) => void }) {
  const path = usePathname(),
    { theme } = useTeamBranding();
  return (
    <View>
      {PLAY_EXPERIENCES.map((item) => {
        const active =
          path === item.nativeHref ||
          path.startsWith(`${item.nativeHref}/`) ||
          (item.id === 'trivia' && path === '/trivia-game');
        return (
          <Pressable
            key={item.id}
            accessibilityRole="link"
            accessibilityState={{ selected: active }}
            onPress={() => navigate(item.nativeHref)}
            style={s.row}
          >
            <Text style={[s.label, active && { color: theme.secondary }]}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="white" />
          </Pressable>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  row: {
    minHeight: 48,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF1A',
  },
  label: { fontSize: 16, fontWeight: '700', color: 'white' },
});
