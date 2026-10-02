import { teamLogoAssets } from '../lib/team-logo-assets';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { gameDayHeroAsset } from '../../../src/config/game-day-hero';
import { getTeamHeroCopy, getTeamHeroDescription } from '../../../src/config/team-hero-copy';
import { getTeamDisplayAccent } from '../../../src/lib/team-theme-tokens';
import { TEAM_LIST } from '../../../src/data/teams';
import { gameWeekLabel, type CanonicalGame } from '../../../src/lib/canonical-game';
import { nextGameDate } from '../../../packages/design/next-game';
import { API_BASE_URL, apiFetch } from '../lib/network';
import type { HomepageGame } from '../lib/api';
type Schedule = {
  game: CanonicalGame | null;
  betting?: {
    eventId: string;
    spread: string | null;
    total: string | null;
    moneyline: string | null;
  } | null;
};
export function HomepageHero({ teamId, game }: { teamId: string; game: HomepageGame | null }) {
  const team = TEAM_LIST.find((t) => t.abbr === teamId),
    copy = getTeamHeroCopy(teamId),
    accent = getTeamDisplayAccent(teamId),
    { width } = useWindowDimensions();
  const [result, setResult] = useState<(Schedule & { team: string; failed?: boolean }) | null>(
      null,
    ),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response = await apiFetch(
          `/api/content/next-game?team=${encodeURIComponent(teamId)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        const body = (await response.json()) as Schedule;
        if (controller.signal.aborted) return;
        setResult({ ...body, team: teamId });
        const until = body.game?.kickoffAt
          ? Date.parse(body.game.kickoffAt) - Date.now()
          : Infinity;
        timer = setTimeout(refresh, Math.max(1000, Math.min(60000, until + 100)));
      } catch {
        if (!controller.signal.aborted) {
          setResult({ team: teamId, game: null, failed: true });
          timer = setTimeout(refresh, 60000);
        }
      }
    }
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [teamId, retry]);
  const current = result?.team === teamId ? result : null,
    next = current?.game;
  const identity = (abbr: string) => {
    const t = TEAM_LIST.find((t) => t.abbr === abbr);
    return (
      <View style={s.team}>
        <Image
          source={teamLogoAssets[abbr]}
          contentFit="contain"
          style={s.logo}
          accessibilityLabel={t?.name ?? abbr}
        />
        <Text style={s.teamName}>
          {t?.name.startsWith(`${t.city} `) ? t.name.slice(t.city.length + 1) : (t?.name ?? abbr)}
        </Text>
      </View>
    );
  };
  const fontSize = Math.max(57.6, Math.min(width * 0.156, 99.84));
  return (
    <View style={s.hero} testID="homepage-stadium-hero">
      <Image
        testID="homepage-stadium-image"
        source={
          teamId === 'KC'
            ? require('../../../public/images/gameday/stadium/kc/gameday.png')
            : { uri: `${API_BASE_URL}${gameDayHeroAsset(teamId)}` }
        }
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="home-shade" x1="0%" x2="100%" y1="0" y2="0">
            <Stop offset="0" stopColor="#03070A" stopOpacity={0.93} />
            <Stop offset=".66" stopColor="#03070A" stopOpacity={0.72} />
            <Stop offset="1" stopColor="#03070A" stopOpacity={0.25} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#home-shade)" />
      </Svg>
      <Text style={s.eyebrow}>
        {team?.name.toUpperCase() ?? teamId}
        {game ? ' · GAMEDAY' : ''}
      </Text>
      <Text
        accessibilityRole="header"
        style={[s.headline, { fontSize, lineHeight: fontSize * 0.94 }]}
      >
        {game ? 'IT’S' : copy.line1.toUpperCase()}
        {'\n'}
        <Text style={{ color: accent }}>
          {game ? 'GAMEDAY.' : teamId === 'SEA' ? copy.line2 : copy.line2.toUpperCase()}
        </Text>
      </Text>
      <View style={[s.intro, { borderLeftColor: accent }]}>
        <Text style={s.description}>
          {game ? `${game.teamName} vs ${game.opponentName}` : getTeamHeroDescription(teamId)}
        </Text>
        {game && (
          <Text style={s.description}>
            {new Intl.DateTimeFormat('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              timeZoneName: 'short',
              timeZone: game.timeZone,
            }).format(new Date(game.startsAt))}
          </Text>
        )}
      </View>
      <View testID="homepage-next-up" style={[s.card, { borderLeftColor: accent }]}>
        <View style={s.row}>
          <Text style={s.cardHeading}>NEXT UP</Text>
          {next && <Text style={s.week}>{gameWeekLabel(next)}</Text>}
        </View>
        {next ? (
          <>
            <View style={s.matchup}>
              {identity(next.awayTeam)}
              <Text style={s.vs}>VS</Text>
              {identity(next.homeTeam)}
            </View>
            <View style={s.details}>
              <Text style={s.date}>{nextGameDate(next)}</Text>
              {!!next.venue && <Text style={s.venue}>{next.venue}</Text>}
            </View>
            {current?.betting && (
              <>
                <View style={s.odds}>
                  {(['spread', 'total', 'moneyline'] as const).map((key) => (
                    <View key={key} style={s.odd}>
                      <Text style={s.oddLabel}>{key.toUpperCase()}</Text>
                      <Text style={[s.price, { color: key === 'total' ? 'white' : accent }]}>
                        {current.betting?.[key] ?? '—'}
                      </Text>
                    </View>
                  ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/parlay-lab',
                      params: { eventId: current.betting!.eventId },
                    })
                  }
                  style={s.link}
                >
                  <Text style={{ color: accent, fontWeight: '800' }}>BUILD A PARLAY →</Text>
                </Pressable>
              </>
            )}
          </>
        ) : (
          <Pressable disabled={!current?.failed} onPress={() => setRetry((v) => v + 1)}>
            <Text style={s.empty}>
              {!current
                ? 'Loading schedule…'
                : current.failed
                  ? 'Schedule temporarily unavailable. Tap to retry.'
                  : 'Schedule coming soon.'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  hero: {
    backgroundColor: '#070A0D',
    paddingHorizontal: 20,
    paddingVertical: 32,
    overflow: 'hidden',
    minHeight: 430,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#C3C6C8',
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: 'BarlowCondensedItalic',
    color: 'white',
    letterSpacing: -0.9,
    marginTop: 28,
    paddingRight: 8,
  },
  intro: { borderLeftWidth: 4, paddingLeft: 16, marginTop: 32 },
  description: { color: 'white', fontSize: 16, fontWeight: '600', lineHeight: 28 },
  card: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#FFFFFF26',
    borderLeftWidth: 4,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(3,14,22,.88)',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  cardHeading: { fontFamily: 'BarlowCondensed', fontSize: 18, letterSpacing: 2.8, color: 'white' },
  week: { fontFamily: 'BarlowCondensed', fontSize: 16, letterSpacing: 1.6, color: '#FFFFFF99' },
  matchup: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 20 },
  team: { flex: 1, alignItems: 'center', gap: 8 },
  logo: { width: 76, height: 76, resizeMode: 'contain' },
  teamName: {
    fontFamily: 'BarlowCondensed',
    fontSize: 23,
    color: 'white',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  vs: { fontFamily: 'BarlowCondensed', fontSize: 21, color: '#FFFFFFA6' },
  details: { borderTopWidth: 1, borderColor: '#FFFFFF26', paddingTop: 15 },
  date: { fontFamily: 'BarlowCondensed', fontSize: 18, color: 'white', letterSpacing: 1 },
  venue: { fontFamily: 'BarlowCondensed', fontSize: 15, color: '#FFFFFFA6', marginTop: 6 },
  empty: { paddingVertical: 24, color: '#FFFFFFB3', fontSize: 20 },
  odds: {
    flexDirection: 'row',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: '#FFFFFF26',
  },
  odd: { flex: 1, alignItems: 'center' },
  oddLabel: { fontFamily: 'BarlowCondensed', fontSize: 12, color: '#FFFFFF99' },
  price: { fontFamily: 'BarlowCondensed', fontSize: 18, marginTop: 4 },
  link: { alignSelf: 'flex-end', paddingTop: 18, paddingBottom: 4 },
});
