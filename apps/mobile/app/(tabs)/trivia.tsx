import { TriviaEvent } from '../../components/trivia-event';
import { EditorialHero } from '../../components/editorial-hero';
import { PageScrollView } from '../../components/page-scroll-view';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTeamBranding } from '../../lib/team-branding';
export default function Trivia() {
  const { theme } = useTeamBranding();
  return (
    <PageScrollView contentContainerStyle={s.page}>
      <View style={{ marginHorizontal: -20, marginTop: -20 }}>
        <EditorialHero
          first="FOUR MINUTE"
          accent="DRILL"
          tagline="10 QUESTIONS. 24 SECONDS. GO THE DISTANCE."
        />
      </View>
      <TriviaEvent />
      <Text style={s.copy}>Quick games built around your team and the league.</Text>
      <Pressable
        style={[s.primary, { backgroundColor: theme.primaryFill }]}
        onPress={() => router.push({ pathname: '/trivia-game', params: { mode: 'solo' } })}
      >
        <Text style={[s.primaryText, { color: theme.onPrimary }]}>PLAY BY MYSELF</Text>
      </Pressable>
      <Pressable
        style={[s.secondary, { borderColor: theme.primary }]}
        onPress={() => router.push({ pathname: '/trivia-game', params: { mode: 'buddies' } })}
      >
        <Text style={[s.secondaryText, { color: theme.primary }]}>PLAY WITH BUDDIES</Text>
      </Pressable>
    </PageScrollView>
  );
}
const s = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: '#001222', padding: 20 },
  copy: { fontSize: 16, color: '#A8BAC4', lineHeight: 22, marginTop: 12, marginBottom: 30 },
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
