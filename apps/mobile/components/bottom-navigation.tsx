import { ParlayIcon } from './parlay-icon';
import { Ionicons } from '@expo/vector-icons';
import { type Href, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { primaryDestinations, editorialDesign as D } from '../../../packages/design/mobile';
import { getTeamDisplayAccent } from '../../../src/lib/team-theme-tokens';
import { useTeam } from '../lib/team-context';
export function BottomNavigation() {
  const router = useRouter(),
    pathname = usePathname(),
    insets = useSafeAreaInsets();
  const { teamId } = useTeam();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboard(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboard(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (keyboard) return null;
  return (
    <View
      style={[
        s.bar,
        {
          paddingBottom: Math.max(insets.bottom, 6),
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {primaryDestinations.map((item) => {
        const selected =
          pathname === item.native ||
          (item.native === '/wire' &&
            (pathname === '/beat' || pathname.startsWith('/beat-story/'))) ||
          (item.native !== '/' && pathname.startsWith(`${item.native}/`));
        const color = selected ? getTeamDisplayAccent(teamId) : '#BCC9CF';
        return (
          <Pressable
            key={item.native}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            onPress={() => router.navigate(item.native as Href)}
            style={s.item}
          >
            {item.native === '/parlay-lab' ? (
              <ParlayIcon name="experiment" size={25} color={color} />
            ) : (
              <Ionicons name={item.icon} size={21} color={color} />
            )}
            <Text numberOfLines={1} adjustsFontSizeToFit style={[s.label, { color }]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  bar: {
    backgroundColor: D.navigation,
    borderTopWidth: 1,
    borderColor: D.border,
    flexDirection: 'row',
    paddingTop: 8,
  },
  item: { flex: 1, minHeight: 46, justifyContent: 'center', alignItems: 'center', gap: 4 },
  label: { fontSize: 9, fontWeight: '700' },
});
