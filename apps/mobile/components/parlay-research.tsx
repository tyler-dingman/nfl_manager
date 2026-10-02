import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import type { ResearchDetail } from '../../../packages/parlay/research';
import { authenticatedFetch } from '../lib/auth';
import type { ParlayMarket } from '../lib/parlay';
import { useTeamBranding } from '../lib/team-branding';
const tabs = ['Overview', 'Game Log', 'Matchup', 'Splits', 'Line Ladder'] as const;
const number = (value: number | null | undefined) =>
  value == null ? '—' : Number(value.toFixed(1)).toString();
const rate = (value: { hits: number; games: number } | undefined) =>
  value?.games
    ? `${Math.round((value.hits / value.games) * 100)}% (${value.hits}/${value.games})`
    : '—';
const odds = (value: number | null) => (value == null ? '—' : `${value > 0 ? '+' : ''}${value}`);
export function ParlayResearch({
  market,
  added,
  onAdd,
}: {
  market: ParlayMarket;
  added: boolean;
  onAdd: (market: ParlayMarket) => void;
}) {
  const { theme } = useTeamBranding();
  const [data, setData] = useState<ResearchDetail | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<(typeof tabs)[number]>('Overview');
  const [window, setWindow] = useState('L10');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError('');
    setTab('Overview');
    const query = new URLSearchParams({
      eventId: market.eventId ?? 'ALL',
      sportsbook: market.sportsbook,
      period: market.period ?? 'full_game',
      playerId: market.playerId ?? '',
      marketType: market.marketType,
      line: String(market.line),
      side: market.side,
    });
    void authenticatedFetch(`/api/parlay-lab/research?${query}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const body = await r.json();
        if (!body.summary || !Array.isArray(body.gameByGame)) throw new Error();
        if (!controller.signal.aborted) setData(body);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Research could not be loaded. Please try again.');
      });
    return () => controller.abort();
  }, [market, retry]);
  const name = (market.playerName ?? market.teamId ?? 'Team market').split(' ');
  const games = data?.gameByGame ?? [];
  const season = Math.max(0, ...games.map((g) => g.season));
  const points =
    window === 'SEASON'
      ? games.filter((g) => g.season === season)
      : window === '2 YEARS'
        ? games.filter((g) => g.season >= season - 1)
        : games.slice(-Number(window.slice(1)));
  const max = Math.max(1, market.line ?? 0, ...points.map((g) => g.value));
  return (
    <View>
      <View style={s.hero}>
        <View style={s.identity}>
          <Text style={s.kicker}>{name.slice(0, -1).join(' ')}</Text>
          <Text style={s.name}>{name.at(-1)}</Text>
          <Text style={s.copy}>
            {market.teamId} · {market.position ?? ''}
          </Text>
          <Text style={s.prop}>
            {market.marketType.replaceAll('_', ' ')} · {market.side} {market.line}
          </Text>
        </View>
        {market.headshotUrl && <Image source={{ uri: market.headshotUrl }} style={s.portrait} />}
      </View>
      <View style={s.row}>
        {(data?.currentPrices?.length ? data.currentPrices : [market]).map((price) => (
          <View key={`${price.id}-${price.sportsbook}`} style={s.price}>
            <Text style={s.copy}>{price.sportsbook}</Text>
            <Text style={s.value}>{odds(price.odds)}</Text>
          </View>
        ))}
      </View>
      <Pressable
        style={[s.button, { backgroundColor: theme.primaryFill }]}
        onPress={() => onAdd(market)}
      >
        <Text style={{ color: theme.onPrimary, fontWeight: '800' }}>
          {added ? 'REMOVE FROM MY PARLAY' : 'ADD TO MY PARLAY +'}
        </Text>
      </Pressable>
      {!!error && (
        <Pressable style={s.card} onPress={() => setRetry((v) => v + 1)}>
          <Text accessibilityRole="alert" style={s.copy}>
            {error}
          </Text>
          <Text style={s.value}>Retry →</Text>
        </Pressable>
      )}
      {!data && !error && <ActivityIndicator color="white" style={{ padding: 24 }} />}
      {data && (
        <>
          <View style={s.grid}>
            {[
              ['L5', rate(data.summary.last5)],
              ['L10', rate(data.summary.last10)],
              ['SEASON', rate(data.summary.season)],
              ['2 YEARS', rate(data.summary.last2Years)],
            ].map(([label, value]) => (
              <View key={label} style={s.metric}>
                <Text style={s.kicker}>{label}</Text>
                <Text style={s.value}>{value}</Text>
              </View>
            ))}
          </View>
          <View style={s.card}>
            <Text style={s.heading}>GAME-BY-GAME PERFORMANCE</Text>
            <View style={s.row}>
              {['L5', 'L10', 'SEASON', '2 YEARS'].map((value) => (
                <Pressable
                  key={value}
                  accessibilityState={{ selected: value === window }}
                  onPress={() => setWindow(value)}
                  style={[s.chip, value === window && { borderColor: theme.secondary }]}
                >
                  <Text style={s.copy}>{value}</Text>
                </Pressable>
              ))}
            </View>
            {points.length ? (
              <ScrollView horizontal>
                <Svg
                  width={Math.max(320, points.length * 30)}
                  height={215}
                  accessibilityLabel={`Game values: ${points.map((g) => `${g.opponent} ${g.value}`).join(', ')}. Current line ${market.line}`}
                >
                  <Line
                    x1={0}
                    x2={Math.max(320, points.length * 30)}
                    y1={180 - ((market.line ?? 0) / max) * 150}
                    y2={180 - ((market.line ?? 0) / max) * 150}
                    stroke="#E7B645"
                    strokeDasharray="4,4"
                  />
                  {points.map((g, i) => (
                    <ViewBar
                      key={`${g.gameId}-${i}`}
                      x={i * 30 + 6}
                      value={g.value}
                      height={(g.value / max) * 150}
                      label={g.opponent}
                      hit={g.result === 'HIT'}
                    />
                  ))}
                </Svg>
              </ScrollView>
            ) : (
              <Text style={s.copy}>No games available for this window.</Text>
            )}
            <Text style={s.copy}>
              Dashed line: {market.line} · Average {number(data.summary.average)} · Median{' '}
              {number(data.summary.median)}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabs}>
            {tabs.map((value) => (
              <Pressable
                key={value}
                onPress={() => setTab(value)}
                accessibilityState={{ selected: tab === value }}
                style={[s.tab, tab === value && { borderBottomColor: theme.secondary }]}
              >
                <Text style={s.value}>{value}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {tab === 'Overview' && (
            <>
              <Card
                title="LAB INSIGHT"
                text={data.generatedInsight ?? 'No generated insight available.'}
              />
              <View style={s.grid}>
                {[
                  ['LAB MATCH SCORE', number(data.labMatchScore)],
                  ['CONSISTENCY', data.consistency?.label ?? '—'],
                  ['AVERAGE MARGIN', number(data.lineMargin?.averageMargin)],
                  ['USAGE TREND', data.usage?.trendLabel ?? '—'],
                ].map(([label, value]) => (
                  <View key={label} style={s.metric}>
                    <Text style={s.kicker}>{label}</Text>
                    <Text style={s.value}>{value}</Text>
                  </View>
                ))}
              </View>
              {data.seasonStats && (
                <View style={s.card}>
                  <Text style={s.heading}>{data.seasonStats.season} SEASON STATS</Text>
                  {data.seasonStats.items.map((item) => (
                    <Text key={item.label} style={s.copy}>
                      {item.label} · {item.value}
                    </Text>
                  ))}
                </View>
              )}
              {data.distribution && (
                <View style={s.card}>
                  <Text style={s.heading}>RESULT DISTRIBUTION</Text>
                  {data.distribution.bins.map((bin) => (
                    <View key={bin.label}>
                      <Text style={s.copy}>
                        {bin.label} · {bin.games} games
                      </Text>
                      <View
                        style={[s.bar, { width: `${Math.min(100, Math.max(0, bin.percentage))}%` }]}
                      />
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
          {tab === 'Game Log' &&
            points.map((g) => (
              <View style={s.card} key={g.gameId}>
                <Text style={s.value}>
                  {g.opponent} · {g.homeAway} · {g.value} · {g.result}
                </Text>
                <Text style={s.copy}>
                  {new Date(g.date).toLocaleDateString()} · Week {g.week} · Margin{' '}
                  {number(g.margin)}
                </Text>
                <Text style={s.copy}>
                  {g.environment?.gameWindow.replaceAll('_', ' ')} · {g.venue?.environment}
                </Text>
              </View>
            ))}
          {tab === 'Matchup' && (
            <>
              <Card
                title={data.upcomingMatchup?.opponentName ?? 'UPCOMING MATCHUP'}
                text={
                  data.upcomingMatchup
                    ? `${data.upcomingMatchup.defenseLabel}: #${data.upcomingMatchup.defenseRank} · ${data.upcomingMatchup.matchupLabel}`
                    : 'Opponent research is unavailable.'
                }
              />
              {data.opponentVsPosition && (
                <View style={s.card}>
                  <Text style={s.heading}>{data.opponentVsPosition.label}</Text>
                  <Text style={s.copy}>{data.opponentVsPosition.qualification}</Text>
                  <Text style={s.value}>Last 10 · {rate(data.opponentVsPosition.last10)}</Text>
                  {data.opponentVsPosition.recentResults.map((g, i) => (
                    <Text key={`${g.gameId}-${i}`} style={s.copy}>
                      Week {g.week} · {g.opponent} · {g.value} · {g.result}
                    </Text>
                  ))}
                </View>
              )}
              {data.gameScript && (
                <Card title="GAME SCRIPT" text={data.gameScript.relevantInsight} />
              )}
            </>
          )}
          {tab === 'Splits' && (
            <>
              {data.environment?.relevantSplits.map((split) => (
                <View key={split.key} style={s.card}>
                  <Text style={s.heading}>{split.label}</Text>
                  <Text style={s.value}>{rate(split.value)}</Text>
                  <Text style={s.copy}>
                    Average {number(split.value.average)} · Median {number(split.value.median)}
                  </Text>
                </View>
              ))}
              {data.environment?.insights.map((item) => (
                <Card key={item.label} title={item.label} text={item.text} />
              ))}
              <Card
                title="VENUE"
                text={data.venue?.relevantInsight ?? 'Venue research is unavailable.'}
              />
              {(['home', 'away', 'vsOpponent'] as const).map((key) => (
                <View key={key} style={s.card}>
                  <Text style={s.heading}>
                    {key === 'vsOpponent' ? 'VS OPPONENT' : key.toUpperCase()}
                  </Text>
                  <Text style={s.value}>{rate(data.summary[key])}</Text>
                </View>
              ))}
            </>
          )}
          {tab === 'Line Ladder' && (
            <>
              <Card
                title="LINE LADDER"
                text={
                  data.lineLadderInsight ?? 'Compare alternate thresholds and available prices.'
                }
              />
              {data.lineLadder?.rows.map((row) => (
                <View
                  key={row.threshold}
                  style={[s.card, row.isCurrentLine && { borderColor: theme.secondary }]}
                >
                  <Text style={s.heading}>
                    {row.displayThreshold} {row.isCurrentLine ? '· CURRENT LINE' : ''}
                  </Text>
                  <Text style={s.copy}>
                    L5 {rate(row.last5)} · L10 {rate(row.last10)}
                  </Text>
                  <Text style={s.copy}>
                    Season {rate(row.season)} · Average margin {number(row.averageMargin)}
                  </Text>
                  {row.markets
                    .filter((m) => m.available)
                    .map((m) => (
                      <Pressable
                        key={`${m.id}-${m.sportsbook}`}
                        style={s.button}
                        onPress={() => onAdd(m)}
                      >
                        <Text style={s.value}>
                          {m.sportsbook} · {odds(m.odds)} · Add +
                        </Text>
                      </Pressable>
                    ))}
                </View>
              ))}
            </>
          )}
        </>
      )}
      {market.deeplink && /^https:\/\//.test(market.deeplink) && (
        <Pressable
          style={s.button}
          onPress={() =>
            void Linking.openURL(market.deeplink!).catch(() =>
              setError('Unable to open sportsbook.'),
            )
          }
        >
          <Text style={s.value}>Open {market.sportsbook} ↗</Text>
        </Pressable>
      )}
    </View>
  );
}
function ViewBar({
  x,
  value,
  height,
  label,
  hit,
}: {
  x: number;
  value: number;
  height: number;
  label: string;
  hit: boolean;
}) {
  return (
    <>
      <Rect
        x={x}
        y={180 - height}
        width={20}
        height={Math.max(1, height)}
        fill={hit ? '#39B895' : '#C96C76'}
      />
      <SvgText x={x + 10} y={174 - height} fill="white" fontSize={9} textAnchor="middle">
        {number(value)}
      </SvgText>
      <SvgText x={x + 10} y={201} fill="#A8BAC4" fontSize={8} textAnchor="middle">
        {label}
      </SvgText>
    </>
  );
}
function Card({ title, text }: { title: string; text: string }) {
  return (
    <View style={s.card}>
      <Text style={s.heading}>{title}</Text>
      <Text style={s.copy}>{text}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  hero: {
    minHeight: 205,
    backgroundColor: '#102532',
    flexDirection: 'row',
    overflow: 'hidden',
    padding: 16,
  },
  identity: { flex: 1, justifyContent: 'center' },
  name: { fontFamily: 'BarlowCondensed', fontSize: 40, color: 'white' },
  portrait: { width: '40%', height: 190, resizeMode: 'contain', alignSelf: 'flex-end' },
  kicker: { color: '#A8BAC4', fontSize: 12, fontWeight: '700' },
  prop: { color: 'white', fontSize: 16, fontWeight: '700', marginTop: 10 },
  copy: { color: '#A8BAC4', fontSize: 13, lineHeight: 21, marginVertical: 6 },
  value: { color: 'white', fontSize: 14, fontWeight: '800' },
  heading: { color: 'white', fontFamily: 'BarlowCondensed', fontSize: 23 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
  price: { borderWidth: 1, borderColor: '#183B4C', padding: 12, borderRadius: 6 },
  button: {
    minHeight: 48,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#183B4C',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#183B4C',
    backgroundColor: '#031923',
    padding: 16,
    borderRadius: 8,
    marginVertical: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 12 },
  metric: {
    width: '48%',
    padding: 14,
    borderWidth: 1,
    borderColor: '#183B4C',
    borderRadius: 6,
    gap: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#183B4C',
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 6,
  },
  tabs: { marginVertical: 12 },
  tab: { padding: 12, minHeight: 48, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  bar: { height: 8, backgroundColor: '#39B895', borderRadius: 4 },
});
