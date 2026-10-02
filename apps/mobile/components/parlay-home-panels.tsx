import { Image as ExpoImage } from 'expo-image';
import { teamLogoAssets } from '../lib/team-logo-assets';
import { useEffect, useState } from 'react';
import { authenticatedFetch } from '../lib/auth';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { TEAM_LIST } from '../../../src/data/teams';
import type { ParlayEvent, ParlayMarket } from '../lib/parlay';
import { ParlayIcon } from './parlay-icon';
import { useTeam } from '../lib/team-context';
import { getEditorialHeroTheme, getTeamThemeTokens } from '../../../src/lib/team-theme-tokens';
const red = '#FF123E',
  gold = '#FFBE00';
export function ParlayHomeHero({
  teamId,
  markets,
  events,
  onOpen,
}: {
  teamId: string;
  markets: ParlayMarket[];
  events: ParlayEvent[];
  onOpen: (m: ParlayMarket) => void;
}) {
  const { heroPrimaryAccent: red, heroBrightAccent: gold } = getEditorialHeroTheme(teamId);
  const team = TEAM_LIST.find((t) => t.abbr === teamId);
  const upcoming = new Set(
    events.filter((e) => Date.parse(e.kickoffAt) > Date.now()).map((e) => e.id),
  );
  const picks = markets
    .filter(
      (m) =>
        m.teamId === teamId &&
        m.available &&
        m.playerId &&
        m.trend &&
        m.eventId &&
        upcoming.has(m.eventId),
    )
    .sort((a, b) => (b.trend?.trendScore ?? 0) - (a.trend?.trendScore ?? 0))
    .slice(0, 3);
  return (
    <View style={s.panel}>
      <View style={{ padding: 20, backgroundColor: '#001222', overflow: 'hidden' }}>
        {[0, 1, 2].map(i => <View key={i} pointerEvents="none" style={{ position: 'absolute', right: -45 + i * 42, bottom: -100, width: 24, height: 320, backgroundColor: red, opacity: 0.12, transform: [{ rotate: '35deg' }] }} />)}
        <Text style={{ fontFamily: 'BarlowCondensedItalic', fontSize: 64, lineHeight: 68, color: 'white', letterSpacing: -1.3 }}>PARLAY <Text style={{ color: red }}>LAB</Text></Text>
        <Text style={{ fontFamily: 'BarlowCondensed', fontSize: 12, letterSpacing: 1, color: 'white' }}>YOUR PLAYBOOK FOR <Text style={{ color: gold }}>BUILDING SMARTER PARLAYS.</Text></Text>
        <View style={s.values}>
          {(
            [
              {
                icon: 'stats',
                title: 'DATA-DRIVEN INSIGHTS',
                copy: 'Find edges with real trends.',
              },
              {
                icon: 'globe',
                title: 'ALL 32 TEAMS',
                copy: 'Research every game, player and market.',
              },
              {
                icon: 'experiment',
                title: 'BUILD BETTER',
                copy: 'Turn insights into smarter parlays.',
              },
            ] as const
          ).map((v) => (
            <View key={v.title} style={{ flex: 1 }}>
              {v.icon === 'globe' ? <Feather name="globe" color={red} size={38} /> : <ParlayIcon name={v.icon} color={red} size={38} />}
              <Text style={s.valueTitle}>{v.title}</Text>
              <Text style={s.small}>{v.copy}</Text>
            </View>
          ))}
        </View>
        <Text style={s.team}>
          {team?.city.toUpperCase()} <Text style={{ color: gold }}>PROPS</Text>
        </Text>
        <Text style={[s.eyebrow, { color: gold }]}>CERTIFIED LAB FINDS</Text>
        {picks.map((m, i) => (
          <Pressable key={m.id} onPress={() => onOpen(m)} style={s.pick}>
            <Text style={{ color: gold, fontWeight: '900' }}>{String(i + 1).padStart(2, '0')}</Text>
            <Text style={[s.copy, { flex: 1 }]}>{m.playerName}</Text>
            <Text style={s.copy}>
              {m.side === 'OVER' ? 'O' : 'U'} {m.line}
            </Text>
          </Pressable>
        ))}
        {!picks.length && (
          <Text style={s.copy}>
            No scored player props are currently available for {team?.city ?? teamId}.
          </Text>
        )}
        <Text style={[s.small, { letterSpacing: 1, marginTop: 24, fontSize: 8 }]}>
          FOR INFORMATIONAL PURPOSES ONLY · PLEASE GAMBLE RESPONSIBLY
        </Text>
      </View>
    </View>
  );
}
export function ParlayAltPromotion({ onGenerate }: { onGenerate: () => void }) {
  const { teamId } = useTeam();
  const { heroPrimaryAccent: red } = getEditorialHeroTheme(teamId);
  const { primaryFill, onPrimary } = getTeamThemeTokens(teamId);
  return (
    <View
      testID="parlay-alt-promotion"
      style={[s.panel, { padding: 20, borderRadius: 12, borderTopColor: red, borderTopWidth: 3, marginVertical: 20 }]}
    >
      <Text style={[s.eyebrow, { color: red }]}>PARLAY LAB</Text>
      <Text style={s.title}>ALT STACK</Text>
      <Text style={s.eyebrow}>HIGH-FREQUENCY ALT LINES. REAL PAYOUT.</Text>
      <Text style={s.copy}>
        We find player props with strong historical hit rates and smart alternate lines — then stack
        them into one parlay for you.
      </Text>
      <View style={s.values}>
        {['REAL DATA', 'SMART ALTS', 'BIGGER PAYOUTS'].map((v, i) => (
          <View key={v} style={{ flex: 1 }}>
            <ParlayIcon
              name={i === 0 ? 'data' : i === 1 ? 'insights' : 'parlay'}
              color={red}
              size={24}
            />
            <Text style={{ color: "#f4f8fc", fontSize: 11, fontWeight: "800", letterSpacing: 0.44, marginTop: 8 }}>{v}</Text>
            <Text style={s.small}>
              {
                [
                  'High hit rates, not hype.',
                  'More cushion below the main line.',
                  'Stack 4, 6, 8 or 10 legs.',
                ][i]
              }
            </Text>
          </View>
        ))}
      </View>
      <Pressable onPress={onGenerate} style={[s.button, { backgroundColor: primaryFill }]}>
        <Text style={[s.buttonText, { color: onPrimary }]}>GENERATE AN ALT STACK →</Text>
      </Pressable>
      <View style={[s.panel, { padding: 16, marginTop: 20 }]}>
        <Text style={[s.eyebrow, { color: red }]}>EXAMPLE</Text>
        <View style={s.pick}>
          <Image
            source={{ uri: 'https://a.espncdn.com/i/headshots/nfl/players/full/4428331.png' }}
            style={{ width: 40, height: 40 }}
          />
          <View>
            <Text style={s.white}>Rashee Rice</Text>
            <Text style={s.small}>Receiving Yards</Text>
          </View>
        </View>
        <View style={[s.pick, { justifyContent: 'space-between' }]}>
          <Text style={s.number}>67.5</Text>
          <Text style={s.copy}>→</Text>
          <Text style={[s.number, { color: '#00e99a' }]}>50+</Text>
        </View>
        <View style={[s.pick, { justifyContent: 'space-between' }]}>
          <Text style={s.small}>MAIN LINE</Text>
          <Text style={s.small}>ALT LINE</Text>
        </View>
        <Text style={s.copy}>9/10 HIT RATE -325 ODDS</Text>
        <Text style={[s.eyebrow, { marginTop: 16 }]}>LAST 10 GAMES</Text>
        <View style={{ flexDirection: 'row', gap: 3, marginTop: 8 }}>
          {Array.from({ length: 10 }, (_, i) => (
            <Text
              key={i}
              style={{
                flex: 1,
                textAlign: 'center',
                color: i === 6 ? red : '#00e99a',
                backgroundColor: i === 6 ? '#3B1624' : '#00372F',
              }}
            >
              {i === 6 ? '×' : '✓'}
            </Text>
          ))}
        </View>
        <Text style={s.small}>Illustrative example · Not live odds</Text>
      </View>
    </View>
  );
}
export function ParlayMovers() {
  const [tab, setTab] = useState('Line Movement');
  const [movement, setMovement] = useState<
    Array<{ marketId: string; oldLine: number; newLine: number; oldOdds: number; newOdds: number }>
  >([]);
  const [status, setStatus] = useState('Loading saved movement…');
  useEffect(() => {
    let active = true;
    void authenticatedFetch('/api/parlay-lab/movement')
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((b) => {
        if (active) {
          setMovement(b.movements ?? []);
          setStatus(b.movements?.length ? '' : 'No saved movement is available for the current props.');
        }
      })
      .catch(() => {
        if (active) setStatus('Saved movement data is unavailable.');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={[s.panel, { padding: 16, marginTop: 16 }]}>
      <View style={s.panelHeading}><ParlayIcon name="stats" size={25} /><Text style={s.panelTitle}>Market Movers</Text></View>
      <View style={s.pick}>
        {['Line Movement', 'Odds Movement', 'Most Bet'].map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{ padding: 8, backgroundColor: tab === t ? '#1C3B49' : '#08212C' }}
          >
            <Text style={s.small}>{t}</Text>
          </Pressable>
        ))}
      </View>
      {tab !== 'Most Bet' &&
        movement.map((m, i) => (
          <Text key={i} style={s.copy}>
            {m.marketId}:{' '}
            {tab === 'Line Movement'
              ? `${m.oldLine} → ${m.newLine}`
              : `${m.oldOdds} → ${m.newOdds}`}
          </Text>
        ))}
      <Text style={s.copy}>
        {tab === 'Most Bet' ? 'Popularity data is not available.' : status}
      </Text>
    </View>
  );
}
export function ParlayHomeFooter({
  events,
  teamId,
  onGame,
}: {
  events: ParlayEvent[];
  teamId: string;
  onGame: (id: string) => void;
}) {
  const next = events
    .filter(
      (e) =>
        (e.homeTeamId === teamId || e.awayTeamId === teamId) &&
        Date.parse(e.kickoffAt) > Date.now(),
    )
    .sort((a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt))[0];
  return (
    <>
      <View style={[s.panel, { padding: 16, marginTop: 20 }]}>
        <View style={s.panelHeading}><ParlayIcon name="experiment" size={25} /><Text style={s.panelTitle}>Next Game</Text></View>
        {next ? (
          <Pressable
            onPress={() => onGame(next.id)}
            style={[
              s.panel,
              { padding: 16, marginTop: 12, borderLeftColor: red, borderLeftWidth: 3 },
            ]}
          >
            <Text style={s.eyebrow}>NEXT UP WEEK {next.week}</Text>
            <View style={[s.pick, { justifyContent: 'space-around', marginVertical: 20 }]}>
              {[next.awayTeamId, next.homeTeamId].map((id) => (
                <View key={id} style={{ alignItems: 'center', gap: 8 }}>
                  <ExpoImage source={teamLogoAssets[id]} style={{ width: 52, height: 52 }} />
                  <Text style={s.white}>{id}</Text>
                </View>
              ))}
            </View>
            <Text style={s.copy}>
              {new Date(next.kickoffAt).toLocaleString('en', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </Pressable>
        ) : (
          <Text style={s.copy}>No upcoming game is available.</Text>
        )}
      </View>
      <View testID="lab-score-guide" style={[s.panel, { padding: 16, marginTop: 20 }]}>
        <View style={s.panelHeading}><ParlayIcon name="test-tube" size={25} /><Text style={s.panelTitle}>Lab Score Guide</Text></View>
        {[
          ['90–100 · HIGH', 'Strong trend alignment.', '#00e99a'],
          ['70–89 · GOOD', 'Supportive trend alignment.', '#3FC59D'],
          ['50–69 · MODERATE', 'Mixed trend signals.', gold],
          ['0–49 · LOW', 'Limited trend alignment.', red],
        ].map(([title, copy, color]) => (
          <View
            key={title}
            style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#183b4c' }}
          >
            <Text style={{ color, fontWeight: '800', fontSize: 12 }}>{title}</Text>
            <Text style={s.small}>{copy}</Text>
          </View>
        ))}
        <Text
          style={{
            backgroundColor: '#FFF2D5',
            padding: 8,
            color: '#142E3D',
            fontSize: 12,
            borderRadius: 4,
          }}
        >
          Research strength, not win probability.
        </Text>
      </View>
    </>
  );
}
const s = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: '#183b4c',
    borderRadius: 8,
    backgroundColor: '#031923',
    overflow: 'hidden',
  },
  values: { flexDirection: 'row', gap: 14, marginVertical: 20 },
  valueTitle: { fontFamily: 'BarlowCondensed', color: 'white', fontSize: 16, lineHeight: 18, marginTop: 8 },
  small: { color: '#9db4c6', fontSize: 12, lineHeight: 18, marginTop: 4 },
  copy: { color: '#9db4c6', fontSize: 14, lineHeight: 23, marginTop: 12 },
  team: { fontFamily: 'BarlowCondensedItalic', fontSize: 25, color: 'white', marginTop: 12 },
  eyebrow: { color: '#D5E0E8', fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  title: { fontFamily: 'BarlowCondensed', fontSize: 36, lineHeight: 36, letterSpacing: -0.9, color: 'white', marginVertical: 8 },
  white: { color: 'white', fontWeight: '800', fontSize: 15 },
  button: {
    backgroundColor: red,
    borderRadius: 5,
    padding: 14,
    alignSelf: 'flex-start',
    marginTop: 18,
  },
  buttonText: { color: 'white', fontWeight: '800', fontSize: 12 },
  number: { color: '#f4f8fc', fontSize: 28, fontWeight: '900', lineHeight: 31 },
  panelHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelTitle: { color: 'white', fontFamily: 'BarlowCondensed', fontSize: 21, lineHeight: 24 },
});
