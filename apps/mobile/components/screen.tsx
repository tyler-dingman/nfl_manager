import type { PropsWithChildren } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { useTeamBranding } from '../lib/team-branding';
export const C = {
  navy: '#081824',
  red: '#E31837',
  gold: '#FFB81C',
  cream: '#F7F2E9',
  ink: '#0B1E2D',
  muted: '#637381',
  white: '#FFFFFF',
};
export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.body}>{children}</ScrollView>
    </SafeAreaView>
  );
}
export function Eyebrow({ children }: { children: React.ReactNode }) {
  const { theme } = useTeamBranding();
  return <Text style={[s.eyebrow, { color: theme.primary }]}>{children}</Text>;
}
export function Heading({ children }: { children: React.ReactNode }) {
  return <Text style={s.heading}>{children}</Text>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  body: { paddingBottom: 36 },
  eyebrow: { fontSize: 13, fontWeight: '900', letterSpacing: 1.6, marginBottom: 7 },
  heading: { fontSize: 28, lineHeight: 31, color: C.ink, fontWeight: '900' },
});
