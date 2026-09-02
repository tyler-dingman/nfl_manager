import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, Eyebrow, Heading } from '../../components/screen';
import { useTeamBranding } from '../../lib/team-branding';
export default function Trivia() {
  const { theme } = useTeamBranding();
  return (
    <View style={s.page}>
      <Eyebrow>TEST YOUR FOOTBALL BRAIN</Eyebrow>
      <Heading>Trivia</Heading>
      <Text style={s.copy}>Quick games built around your team and the league.</Text>
      <Pressable
        style={[s.primary, { backgroundColor: theme.primary }]}
        onPress={() => router.push({ pathname: '/trivia-game', params: { mode: 'solo' } })}
      >
        <Text style={[s.primaryText, { color: theme.light }]}>PLAY BY MYSELF</Text>
      </Pressable>
      <Pressable
        style={[s.secondary, { borderColor: theme.primary }]}
        onPress={() => router.push({ pathname: '/trivia-game', params: { mode: 'buddies' } })}
      >
        <Text style={[s.secondaryText, { color: theme.primary }]}>PLAY WITH BUDDIES</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream, padding: 20 },
  copy: { fontSize: 16, color: C.muted, lineHeight: 22, marginTop: 12, marginBottom: 30 },
  primary: { borderRadius: 16, padding: 19, alignItems: 'center' },
  primaryText: { fontWeight: '900', letterSpacing: 1 },
  secondary: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 17,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryText: { fontWeight: '900', letterSpacing: 1 },
});
