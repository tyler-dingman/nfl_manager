import { PageScrollView as ScrollView } from './page-scroll-view';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    <SafeAreaView style={s.safe} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={s.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={s.body}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
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
  // A stacked screen fills its safe-area container; child sections inherit its gutters.
  body: { paddingBottom: 36, width: '100%', minWidth: 0, alignItems: 'stretch' },
  eyebrow: { fontSize: 13, fontWeight: '900', letterSpacing: 1.6, marginBottom: 7 },
  heading: { fontSize: 28, lineHeight: 31, color: C.ink, fontWeight: '900' },
});
