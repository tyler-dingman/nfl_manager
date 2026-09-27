import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRIMARY_NAV_ITEMS } from '../../../src/config/primary-navigation';
import { FOOTER_INFORMATION, footerCopyright } from '../../../packages/navigation/footer';
import { destinations } from './mobile-navigation';
import { API_BASE_URL } from '../lib/network';

export function SiteFooter() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.footer, { paddingBottom: Math.max(20, insets.bottom) }]}>
      <Text style={s.brand}>DOWN &amp; DISTANCE</Text>
      <View style={s.links}>
        {PRIMARY_NAV_ITEMS.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="link"
            style={s.link}
            onPress={() => {
              const native = destinations.find((d) => d.label === item.label);
              if (native) router.push(native.href);
              else void Linking.openURL(`${API_BASE_URL}${item.href}`);
            }}
          >
            <Text style={s.label}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.info}>
        {FOOTER_INFORMATION.map((label) => (
          <Text key={label} style={s.muted}>
            {label}
          </Text>
        ))}
      </View>
      <Text style={[s.muted, { marginTop: 16 }]}>{footerCopyright(new Date().getFullYear())}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  footer: { alignSelf: 'stretch', backgroundColor: '#00121b', padding: 16, marginTop: 24 },
  brand: { color: 'white', fontSize: 18, fontWeight: '800', fontStyle: 'italic', lineHeight: 18 },
  links: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  link: { width: '33.333%', minHeight: 44, justifyContent: 'center' },
  label: { color: 'white', fontSize: 12, fontWeight: '700' },
  info: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16 },
  muted: { color: '#b4c2ca', fontSize: 11 },
});
