import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { C, Eyebrow, Heading } from '../../components/screen';
import { StoryCard } from '../../components/story-card';
import { EditorialVisual } from '../../components/editorial-visual';
import { getCatchUp, getHome, getRewards } from '../../lib/api';
import type { HomeData } from '../../lib/types';
import { useTeam } from '../../lib/team-context';
import { useTeamBranding } from '../../lib/team-branding';
export default function Home() {
  const { teamId } = useTeam();
  const { theme } = useTeamBranding();
  const [data, setData] = useState<HomeData | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [catchUpCount, setCatchUpCount] = useState<number | null>(null),
    [yards, setYards] = useState<number | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getHome(teamId);
      setData(result.data);
      void getCatchUp(teamId)
        .then((v) => setCatchUpCount(v.totalMeaningfulChanges))
        .catch(() => setCatchUpCount(null));
      void getRewards()
        .then((v) => setYards(v.progress.currentDriveYards))
        .catch(() => setYards(null));
    } catch (caught) {
      setData(null);
      setError(caught instanceof Error ? caught.message : 'Home is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);
  useEffect(() => {
    void load();
  }, [load]);
  const stories = data?.threeAndOut?.current.stories ?? [];
  return (
    <View style={s.safe}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={s.body}
      >
        <Eyebrow>{data?.threeAndOut?.current.teamName ?? 'KANSAS CITY CHIEFS'}</Eyebrow>
        <Heading>Your team. Right now.</Heading>
        {error ? (
          <View style={s.stateCard}>
            <Text style={s.stateTitle}>We couldn’t load your team.</Text>
            <Text style={s.stateBody}>{error}</Text>
            <Pressable onPress={() => void load()}><Text style={[s.retry, { color: theme.primary }]}>TRY AGAIN →</Text></Pressable>
          </View>
        ) : null}
        <Pressable style={[s.gameDay, { backgroundColor: theme.dark }]} onPress={() => router.push('/game-day')}>
          <View>
            <Text style={[s.gameEyebrow, { color: theme.secondary }]}>YOUR TAILGATE IS OPEN</Text>
            <Text style={[s.gameTitle, { color: theme.light }]}>Game Day</Text>
            <Text style={[s.gameBody, { color: theme.light }]}>Watch. Tap. React. Keep watching.</Text>
          </View>
          <Text style={[s.gameArrow, { color: theme.secondary }]}>›</Text>
        </Pressable>
        <Pressable style={[s.catchup, { backgroundColor: theme.primary }]} onPress={() => router.push('/catch-up')}>
          <Text style={[s.catchEyebrow, { color: theme.secondary }]}>GET CAUGHT UP</Text>
          <Text style={[s.catchTitle, { color: theme.light }]}>While you were away</Text>
          <Text style={[s.catchBody, { color: theme.light }]}>
            {catchUpCount
              ? `${catchUpCount} meaningful update${catchUpCount === 1 ? '' : 's'} since your last visit.`
              : 'Open the latest meaningful changes without reading every article.'}
          </Text>
        </Pressable>
        <Pressable style={[s.rewards, { backgroundColor: theme.dark }]} onPress={() => router.push('/rewards')}>
          <View>
            <Text style={[s.rewardLabel, { color: theme.secondary }]}>MOVE THE CHAINS</Text>
            <Text style={[s.rewardTitle, { color: theme.light }]}>Engagement Rewards</Text>
          </View>
          <Text style={[s.yards, { color: theme.light }]}>{yards ?? '—'} YDS ›</Text>
        </Pressable>
        <View style={s.sectionRow}>
          <Text style={s.section}>THREE AND OUT</Text>
          <Pressable onPress={() => router.push('/three')}>
            <Text style={[s.link, { color: theme.primary }]}>SEE ALL →</Text>
          </Pressable>
        </View>
        {stories.map((story, i) => (
          <StoryCard key={story.id} story={story} down={`${['1ST', '2ND', '3RD'][i]} DOWN`} />
        ))}
        {!loading && !error && stories.length === 0 ? (
          <Text style={s.empty}>No Three and Out stories are ready for this team yet.</Text>
        ) : null}
        <View style={s.sectionRow}>
          <Text style={s.section}>THE HUDDLE</Text>
          <Text style={[s.link, { color: theme.primary }]}>SEE THE WHOLE FIELD →</Text>
        </View>
        {data?.huddle.slice(0, 4).map((item) => (
          <View key={item.id} style={s.huddle}>
            <EditorialVisual
              story={{
                teamId,
                category: item.category,
                headline: item.headline,
                summary: item.summary,
              }}
              variant="compact"
            />
            <Text style={[s.label, { color: theme.primary }]}>{item.category}</Text>
            <Text style={s.hTitle}>{item.headline}</Text>
            <Text style={s.hBody}>{item.summary}</Text>
            <Text style={s.hSource}>{item.sources[0]?.publisher ?? 'Down & Distance'} →</Text>
          </View>
        ))}
        {!loading && !error && data?.huddle.length === 0 ? (
          <Text style={s.empty}>No Huddle updates are available yet.</Text>
        ) : null}
        <Text style={s.section}>THE WIRE</Text>
        {data?.wire.slice(0, 3).map((item) => (
          <View key={item.id} style={[s.wire, { borderLeftColor: theme.primary }]}>
            <Text style={s.time}>
              {new Date(item.occurredAt).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
            <Text style={s.wireTitle}>{item.headline}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  body: { padding: 18, paddingBottom: 40 },
  catchup: { borderRadius: 20, padding: 20, marginTop: 22 },
  gameDay: {
    borderRadius: 20,
    padding: 20,
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gameEyebrow: { fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  gameTitle: { fontSize: 27, fontWeight: '900', marginTop: 8 },
  gameBody: { fontSize: 16, lineHeight: 22, marginTop: 5 },
  gameArrow: { fontSize: 40, fontWeight: '900' },
  catchEyebrow: { fontSize: 13, fontWeight: '900', letterSpacing: 1.4 },
  catchTitle: { fontSize: 24, fontWeight: '900', marginTop: 12 },
  catchBody: { lineHeight: 20, marginTop: 6 },
  rewards: {
    borderRadius: 16,
    padding: 17,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rewardLabel: { fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  rewardTitle: { fontSize: 17, fontWeight: '900', marginTop: 4 },
  yards: { fontWeight: '900' },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 12,
  },
  section: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.8,
    color: C.ink,
    marginTop: 28,
    marginBottom: 12,
  },
  link: { fontSize: 13, fontWeight: '900' },
  huddle: { padding: 17, backgroundColor: C.white, borderRadius: 16, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  hTitle: { fontSize: 18, fontWeight: '900', color: C.ink, marginTop: 7 },
  hBody: { fontSize: 16, lineHeight: 23, color: C.muted, marginTop: 7 },
  hSource: { fontSize: 13, fontWeight: '900', color: C.ink, marginTop: 10 },
  wire: {
    borderLeftWidth: 3,
    paddingLeft: 14,
    paddingVertical: 8,
    marginBottom: 8,
  },
  time: { fontSize: 13, fontWeight: '900', color: C.muted },
  wireTitle: { fontSize: 15, fontWeight: '800', color: C.ink, marginTop: 4 },
  stateCard: { backgroundColor: C.white, borderRadius: 16, padding: 18, marginTop: 20 },
  stateTitle: { color: C.ink, fontSize: 17, fontWeight: '900' },
  stateBody: { color: C.muted, lineHeight: 19, marginTop: 7 },
  retry: { fontSize: 13, fontWeight: '900', marginTop: 14 },
  empty: { color: C.muted, lineHeight: 20, marginBottom: 12 },
});
