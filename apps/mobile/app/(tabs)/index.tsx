import { Image } from 'expo-image';
import { Linking } from 'react-native';
import { HomeBeatCard, openHomeBriefing } from '../../components/home-beat-card';
import { HomeAiSearch } from '../../components/home-ai-search';
import { TEAM_LIST } from '../../../../src/data/teams';
import { HomeFilmRoom } from '../../components/home-film-room';
import { HomepageHero } from '../../components/homepage-hero';
import { PageScrollView as ScrollView } from '../../components/page-scroll-view';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { type Href, router } from 'expo-router';
import { C } from '../../components/screen';
import { getHome, getHomepageGame, type HomepageGame } from '../../lib/api';
import type { HomeData } from '../../lib/types';
import { useTeam } from '../../lib/team-context';
import { useTeamBranding } from '../../lib/team-branding';
export default function Home() {
  const { teamId } = useTeam();
  const { theme } = useTeamBranding();
  const [data, setData] = useState<HomeData | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<HomepageGame | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getHome(teamId);
      setData(result.data);
      void getHomepageGame(teamId)
        .then(setGame)
        .catch(() => setGame(null));
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
  return (
    <View style={s.safe}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={s.body}
      >
        <View style={{ marginHorizontal: -18, marginTop: -18, marginBottom: 20 }}>
          <HomepageHero teamId={teamId} game={game?.teamAbbr === teamId ? game : null} />
        </View>
        {error ? (
          <View style={s.stateCard}>
            <Text style={s.stateTitle}>We couldn’t load your team.</Text>
            <Text style={s.stateBody}>{error}</Text>
            <Pressable onPress={() => void load()}>
              <Text style={[s.retry, { color: theme.primary }]}>TRY AGAIN →</Text>
            </Pressable>
          </View>
        ) : null}
        <HomeAiSearch key={teamId} />
        <Pressable accessibilityRole="button" onPress={() => router.push(`/huddle?team=${teamId}` as never)} style={{ padding: 18, marginVertical: 16, backgroundColor: '#061a22', borderRadius: 12 }}><Text style={{ color: 'white', fontWeight: '700' }}>THE HUDDLE · Join your team’s conversation →</Text></Pressable>
        <Text
          style={{
            color: theme.primary,
            fontSize: 12,
            letterSpacing: 2.8,
            fontWeight: '900',
            marginBottom: 8,
          }}
        >
          ✧ THE BEAT
        </Text>
        <Text style={s.contentTitle}>
          What {TEAM_LIST.find((t) => t.abbr === teamId)?.name ?? teamId} fans need to know
        </Text>
        {data?.huddle.slice(0, 3).map((item) => (
          <HomeBeatCard key={item.id} item={item} teamId={teamId} />
        ))}
        <Pressable
          accessibilityLabel="DraftKings advertisement"
          onPress={() => void Linking.openURL('https://sportsbook.draftkings.com/')}
          style={{ marginBottom: 24 }}
        >
          <Image
            source={require('../../../../public/images/ads/draftkings_the_beat_banner.png')}
            contentFit="contain"
            style={{ width: '100%', aspectRatio: 1002 / 256, borderRadius: 16 }}
          />
        </Pressable>
        {!loading && !error && data?.huddle.length === 0 ? (
          <Text style={s.empty}>No verified Beat stories are ready for this team yet.</Text>
        ) : null}
        <View
          testID="home-three-and-out"
          style={{
            backgroundColor: '#00121D',
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: '#65819855',
          }}
        >
          <Text style={{ fontFamily: 'BarlowCondensed', fontSize: 26, color: 'white' }}>
            THREE &amp; OUT
          </Text>
          <Text style={{ fontFamily: 'BarlowCondensed', fontSize: 14, color: theme.secondary }}>
            THE 3 THINGS YOU NEED TO KNOW
          </Text>
          {(data?.huddle ?? []).slice(0, 3).map((item, i) => (
            <Pressable
              key={item.id}
              onPress={() => openHomeBriefing(item)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#FFFFFF20',
              }}
            >
              <Text
                style={{
                  fontFamily: 'BarlowCondensed',
                  fontSize: 22,
                  color: 'white',
                  borderWidth: 2,
                  borderColor: theme.secondary,
                  borderRadius: 22,
                  width: 40,
                  height: 40,
                  textAlign: 'center',
                  lineHeight: 35,
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </Text>
              <Text style={{ flex: 1, color: 'white', fontSize: 14, lineHeight: 20 }}>
                {item.headline}
              </Text>
              <Text style={{ color: 'white' }}>›</Text>
            </Pressable>
          ))}
          {!data?.huddle.length && (
            <Text style={{ color: '#CBD5E1', marginTop: 12 }}>
              Current developments will appear here as reporting becomes available.
            </Text>
          )}
          <Pressable onPress={() => router.push('/three')} style={{ paddingTop: 16 }}>
            <Text style={{ color: 'white', fontSize: 12 }}>Delivery preferences →</Text>
          </Pressable>
        </View>
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
        <HomeFilmRoom />
        <View style={[s.ask, { marginTop: 40, padding: 24 }]}>
          <Text style={[s.label, { color: '#EA580C' }]}>FAN DISCUSSION</Text>
          <Text style={s.contentTitle}>Fans are talking about...</Text>
          <Text style={s.hBody}>
            Join your crew to share stories and talk football with other fans.
          </Text>
          <Pressable onPress={() => router.push('/crew')}>
            <Text style={[s.retry, { color: theme.primary }]}>Open fan discussion →</Text>
          </Pressable>
        </View>
        <View style={[s.ask, { marginTop: 24, padding: 24 }]}>
          <Text style={[s.label, { color: theme.primary }]}>FRONT OFFICE</Text>
          <Text style={s.contentTitle}>Build the complete picture</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
            {['Depth chart', 'Cap outlook', 'Transactions', 'Draft capital'].map((label) => (
              <Pressable
                key={label}
                onPress={() => router.push('/front-office')}
                style={{
                  width: '47%',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <Text style={s.hTitle}>{label}</Text>
                <Text style={s.hBody}>Explore →</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => router.push('/front-office')}
            style={{ marginTop: 20, padding: 16, borderRadius: 16, backgroundColor: theme.dark }}
          >
            <Text style={{ color: 'white', fontWeight: '900' }}>
              Take control in Front Office →
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  contentTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: C.ink,
    marginBottom: 16,
    marginTop: 8,
  },
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
  gameMeta: { fontSize: 12, opacity: 0.72, marginTop: 6 },
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
  ask: {
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5DED3',
    padding: 18,
    marginTop: 10,
  },
  askLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  askTitle: { color: C.ink, fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: 7 },
  askPrompt: { color: C.muted, fontSize: 13, marginTop: 6 },
});
