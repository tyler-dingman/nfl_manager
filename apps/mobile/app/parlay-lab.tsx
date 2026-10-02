import { ParlayGenerator } from '../components/parlay-generator';
import { ParlayIcon } from '../components/parlay-icon';
import {
  ParlayHomeHero,
  ParlayAltPromotion,
  ParlayMovers,
  ParlayHomeFooter,
} from '../components/parlay-home-panels';
import { useLocalSearchParams } from 'expo-router';
import { ParlayAltStack } from '../components/parlay-alt-stack';
import { ParlayPlayers } from '../components/parlay-players';
import { TEAM_LIST } from '../../../src/data/teams';
import { API_BASE_URL } from '../lib/network';
import { ParlayResearch } from '../components/parlay-research';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ParlayBuild } from '../components/parlay-build';
import { authenticatedFetch } from '../lib/auth';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PageScrollView } from '../components/page-scroll-view';
import { EditorialHero } from '../components/editorial-hero';
import { SectionMenu } from '../components/section-menu';
import {
  getParlayEvents,
  getParlayMarkets,
  type ParlayEvent,
  type ParlayMarket,
} from '../lib/parlay';
import { useTeamBranding } from '../lib/team-branding';
import { getEditorialHeroTheme } from '../../../src/lib/team-theme-tokens';
const label = (value: string) => value.replaceAll('_', ' ');
export default function ParlayLab() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const { teamId } = useTeamBranding();
  const colors = getEditorialHeroTheme(teamId);
  const [createOpen, setCreateOpen] = useState(false);
  const [events, setEvents] = useState<ParlayEvent[]>([]),
    [markets, setMarkets] = useState<ParlayMarket[]>([]);
  const [section, setSection] = useState<
    | 'home'
    | 'games'
    | 'players'
    | 'trends'
    | 'teams'
    | 'generator'
    | 'alt-stack'
    | 'my-plays'
    | 'settings'
  >('home');
  const [researchTeam, setResearchTeam] = useState('ALL');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [sideFilter, setSideFilter] = useState('ALL'),
    [bookFilter, setBookFilter] = useState('ALL'),
    [myTeamOnly, setMyTeamOnly] = useState(false);
  const [event, setEvent] = useState('ALL'),
    [search, setSearch] = useState(''),
    [selected, setSelected] = useState<ParlayMarket | null>(null);
  useEffect(() => {
    if (eventId) {
      setEvent(eventId);
      setSection('home');
    }
  }, [eventId]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [slip, setSlip] = useState<ParlayMarket[]>([]);
  const request = useRef(0);
  const isAltStack = section === 'alt-stack';
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError('');
    try {
      const [games, research] = await Promise.all([
        getParlayEvents(),
        isAltStack
          ? authenticatedFetch('/api/parlay-lab/alt-stack').then(async (r) => {
              if (!r.ok) throw new Error('Alt Stack is unavailable. Pull down to retry.');
              return r.json() as Promise<{ markets: ParlayMarket[] }>;
            })
          : getParlayMarkets(event),
      ]);
      if (!Array.isArray(games.events) || !Array.isArray(research.markets))
        throw new Error('Research data is unavailable. Pull down to retry.');
      if (id !== request.current) return;
      setEvents(games.events);
      setMarkets(research.markets);
    } catch (e) {
      if (id === request.current)
        setError(e instanceof Error ? e.message : 'Unable to load research.');
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [event, isAltStack]);
  useEffect(() => {
    setMarkets([]);
    void load();
    return () => {
      request.current++;
    };
  }, [load]);
  const visible = useMemo(() => {
    const rows = markets.filter(
      (m) =>
        m.available &&
        (sideFilter === 'ALL' || m.side === sideFilter) &&
        (bookFilter === 'ALL' || m.sportsbook === bookFilter) &&
        (!myTeamOnly || m.teamId === teamId) &&
        (researchTeam === 'ALL' || m.teamId === researchTeam) &&
        (marketFilter === 'ALL' || m.marketType === marketFilter) &&
        `${m.playerName ?? m.teamId} ${label(m.marketType)}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
    return section === 'trends'
      ? rows
          .filter((m) => m.trend)
          .sort((a, b) => (b.trend?.trendScore ?? 0) - (a.trend?.trendScore ?? 0))
      : rows;
  }, [
    markets,
    search,
    section,
    researchTeam,
    marketFilter,
    sideFilter,
    bookFilter,
    myTeamOnly,
    teamId,
  ]);
  return (
    <PageScrollView
      style={s.page}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="white" />}
    >
      <SectionMenu
        navigation={{ inset: 16, top: true }}
        title="Explore Parlay Lab"
        items={(
          [
            'home',
            'trends',
            'games',
            'players',
            'teams',
            'generator',
            'alt-stack',
            'my-plays',
            'settings',
          ] as const
        ).map((key) => ({
          label:
            key === 'home'
              ? 'Parlay Lab'
              : key === 'my-plays'
                ? 'My Parlays'
                : key === 'generator'
                  ? 'Parlay Generator'
                  : key === 'alt-stack'
                    ? 'Alt Stack'
                    : key[0].toUpperCase() + key.slice(1),
          selected: section === key,
          onPress: () => setSection(key),
        }))}
      />
      {section === 'home' && (
        <View style={s.stats}>
          <Stat value={markets.filter((m) => m.available).length} label="ACTIVE PROPS" />
          <Stat
            value={markets.filter((m) => (m.trend?.last10.hitRate ?? 0) >= 70).length}
            label="TRENDING NOW"
          />
          <Stat
            value={markets.filter((m) => (m.trend?.trendScore ?? 0) >= 90).length}
            label="90+ LAB SCORES"
          />
          <Stat value={events.length} label="GAMES ON BOARD" />
        </View>
      )}
      {section === 'home' && (
        <>
          <ParlayHomeHero teamId={teamId} markets={markets} events={events} onOpen={setSelected} />
          <ParlayAltPromotion onGenerate={() => setSection('alt-stack')} />
        </>
      )}
      {error ? (
        <Pressable accessibilityRole="button" onPress={load} style={s.card}>
          <Text style={s.text}>{error}</Text>
          <Text style={{ color: colors.heroBrightAccent }}>Try again</Text>
        </Pressable>
      ) : null}
      {loading && !markets.length ? (
        <ActivityIndicator color={colors.heroBrightAccent} style={{ padding: 20 }} />
      ) : null}
      {['generator', 'my-plays'].includes(section) ? null : section === 'settings' ? (
        <View style={s.card}>
          <Text style={s.heading}>Your Parlay Lab preferences</Text>
          <Text style={s.muted}>
            Your selected team personalizes highlights. NFL-wide research remains available on every
            page.
          </Text>
          <Pressable style={s.close} onPress={() => setSection('teams')}>
            <Text style={s.text}>Change team →</Text>
          </Pressable>
        </View>
      ) : section === 'alt-stack' ? (
        <ParlayAltStack events={events} slip={slip} setSlip={setSlip} onOpen={setSelected} />
      ) : section === 'players' ? (
        <ParlayPlayers markets={markets} onOpen={setSelected} />
      ) : section === 'teams' ? (
        <View style={s.teamGrid}>
          {TEAM_LIST.map((team) => (
            <Pressable
              key={team.abbr}
              style={s.teamCard}
              onPress={() => {
                setResearchTeam(team.abbr);
                setSection('home');
              }}
            >
              <Image
                source={{
                  uri: team.logoUrl.startsWith('http')
                    ? team.logoUrl
                    : `${API_BASE_URL}${team.logoUrl}`,
                }}
                style={{ width: 55, height: 45, resizeMode: 'contain' }}
              />
              <Text style={s.title}>{team.name}</Text>
              <Text style={s.muted}>
                {markets.filter((m) => m.available && m.teamId === team.abbr).length} available
                research props
              </Text>
            </Pressable>
          ))}
        </View>
      ) : section === 'games' ? (
        events.map((game) => (
          <Pressable
            accessibilityRole="button"
            key={game.id}
            style={s.card}
            onPress={() => {
              setEvent(game.id);
              setSection('home');
            }}
          >
            <Text style={s.title}>
              {game.awayTeamId} @ {game.homeTeamId}
            </Text>
            <Text style={s.muted}>
              WEEK {game.week} · {new Date(game.kickoffAt).toLocaleString()}
            </Text>
            <Text style={{ color: colors.heroBrightAccent }}>Explore markets →</Text>
          </Pressable>
        ))
      ) : (
        <>
          <Text style={s.heading}>
            {section === 'home'
              ? 'Trending Props'
              : section === 'trends'
                ? 'TRENDING PROPS'
                : 'PLAYER PROPS'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
            {[
              ['ALL', 'All Props'],
              ['PASSING_YARDS', 'Passing'],
              ['RUSHING_YARDS', 'Rushing'],
              ['RECEIVING_YARDS', 'Receiving'],
              ['RECEPTIONS', 'Receptions'],
            ].map(([value, title]) => (
              <Pressable
                key={value}
                onPress={() => setMarketFilter(value)}
                style={{
                  padding: 10,
                  borderRadius: 3,
                  backgroundColor: marketFilter === value ? colors.heroPrimaryAccent : '#092532',
                }}
              >
                <Text style={{ color: 'white', fontSize: 10 }}>{title}</Text>
              </Pressable>
            ))}
          </View>
          <SectionMenu
            dark
            title={event === 'ALL' ? 'All games' : 'Selected game'}
            items={[
              { label: 'All games', selected: event === 'ALL', onPress: () => setEvent('ALL') },
              ...events.map((game) => ({
                label: `${game.awayTeamId} @ ${game.homeTeamId}`,
                selected: event === game.id,
                onPress: () => setEvent(game.id),
              })),
            ]}
          />
          <SectionMenu
            dark
            title={`Team: ${researchTeam}`}
            items={[
              {
                label: 'All teams',
                selected: researchTeam === 'ALL',
                onPress: () => setResearchTeam('ALL'),
              },
              ...TEAM_LIST.map((team) => ({
                label: team.name,
                selected: researchTeam === team.abbr,
                onPress: () => setResearchTeam(team.abbr),
              })),
            ]}
          />
          <SectionMenu
            dark
            title={marketFilter === 'ALL' ? 'All markets' : label(marketFilter)}
            items={['ALL', ...new Set(markets.map((m) => m.marketType))].map((value) => ({
              label: value === 'ALL' ? 'All markets' : label(value),
              selected: marketFilter === value,
              onPress: () => setMarketFilter(value),
            }))}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <SectionMenu
                dark
                title={sideFilter === 'ALL' ? 'Over / Under' : sideFilter}
                items={['ALL', 'OVER', 'UNDER'].map((v) => ({
                  label: v,
                  onPress: () => setSideFilter(v),
                  selected: v === sideFilter,
                }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SectionMenu
                dark
                title={bookFilter === 'ALL' ? 'All Sportsbooks' : bookFilter}
                items={['ALL', ...new Set(markets.map((m) => m.sportsbook))].map((v) => ({
                  label: v,
                  onPress: () => setBookFilter(v),
                  selected: v === bookFilter,
                }))}
              />
            </View>
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: myTeamOnly }}
            onPress={() => setMyTeamOnly((v) => !v)}
            style={{ paddingVertical: 12 }}
          >
            <Text style={s.muted}>{myTeamOnly ? '☑' : '☐'} My Team Only</Text>
          </Pressable>
          <TextInput
            accessibilityLabel="Search players and markets"
            placeholder="Search players or markets"
            placeholderTextColor="#A8BAC4"
            value={search}
            onChangeText={setSearch}
            style={s.input}
          />
          {!loading && !error && !visible.length && (
            <Text style={s.muted}>No props match this selection. Try another game or player.</Text>
          )}
          {visible.slice(0, 100).map((m) => (
            <Pressable
              accessibilityRole="button"
              key={`${m.id}-${m.sportsbook}-${m.side}`}
              style={s.card}
              onPress={() => setSelected(m)}
            >
              <View style={s.row}>
                {m.headshotUrl && <Image source={{ uri: m.headshotUrl }} style={s.avatar} />}
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>{m.playerName ?? m.teamId ?? 'Team market'}</Text>
                  <Text style={s.muted}>
                    {m.teamId} · {label(m.marketType)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${m.playerName ?? 'prop'} to parlay`}
                  onPress={(e) => {
                    e.stopPropagation();
                    setSlip((current) =>
                      current.some((x) => x.id === m.id && x.sportsbook === m.sportsbook)
                        ? current.filter((x) => !(x.id === m.id && x.sportsbook === m.sportsbook))
                        : [...current, m],
                    );
                  }}
                  style={{ padding: 12, backgroundColor: '#12313F', borderRadius: 4 }}
                >
                  <Text style={{ color: 'white' }}>
                    {slip.some((x) => x.id === m.id && x.sportsbook === m.sportsbook) ? '✓' : '+'}
                  </Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
                {[
                  [
                    'PROP',
                    `${m.side === 'OVER' ? 'O' : 'U'} ${m.line ?? '—'} ${label(m.marketType)}`,
                  ],
                  [
                    'GAME',
                    events.find((e) => e.id === m.eventId)
                      ? `${events.find((e) => e.id === m.eventId)!.awayTeamId} @ ${events.find((e) => e.id === m.eventId)!.homeTeamId}`
                      : '—',
                  ],
                  ['LINE', `${m.side === 'OVER' ? 'O' : 'U'} ${m.line ?? '—'}`],
                  ['ODDS', m.odds == null ? '—' : `${m.odds > 0 ? '+' : ''}${m.odds}`],
                  ['LAB SCORE', m.trend ? String(Math.round(m.trend.trendScore)) : '—'],
                  ['L/10', m.trend ? `${m.trend.last10.hits}/${m.trend.last10.games}` : '—'],
                ].map(([label, value]) => (
                  <View key={label} style={{ width: '29%' }}>
                    <Text style={{ color: '#7E99AA', fontSize: 9, letterSpacing: 1 }}>{label}</Text>
                    <Text
                      style={{
                        color: label === 'LAB SCORE' ? '#00D7AE' : '#E2EBF0',
                        fontSize: 12,
                        fontWeight: '700',
                        marginTop: 4,
                      }}
                    >
                      {value}
                    </Text>
                  </View>
                ))}
              </View>
            </Pressable>
          ))}
          {visible.length > 100 && (
            <Text style={s.muted}>
              Showing 100 of {visible.length} props. Search or choose a game to narrow the results.
            </Text>
          )}
        </>
      )}
      {section === 'home' && <ParlayMovers />}
      {
        <ParlayBuild
          events={events}
          section={section}
          teamId={teamId}
          slip={slip}
          setSlip={setSlip}
          onOpen={setSelected}
        />
      }
      {section === 'home' && (
        <Pressable
          onPress={() => setCreateOpen(true)}
          style={{
            backgroundColor: colors.heroPrimaryAccent,
            padding: 12,
            borderRadius: 5,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ParlayIcon name="experiment" size={22} />
          <Text
            style={{
              color: 'white',
              textAlign: 'center',
              fontFamily: 'BarlowCondensed',
              fontSize: 20,
            }}
          >
            Create a Parlay
          </Text>
        </Pressable>
      )}
      {section === 'home' && (
        <ParlayHomeFooter
          events={events}
          teamId={teamId}
          onGame={(id) => {
            setEvent(id);
            setSection('games');
          }}
        />
      )}
      <Modal
        visible={createOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateOpen(false)}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: '#000910a6', justifyContent: 'center', padding: 12 }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{
              maxHeight: '96%',
              width: '100%',
              maxWidth: 840,
              alignSelf: 'center',
              borderWidth: 1,
              borderColor: '#426170',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <PageScrollView keyboardShouldPersistTaps="handled">
              <ParlayGenerator
                teamId={teamId}
                slip={slip}
                setSlip={setSlip}
                onOpen={(market) => {
                  setCreateOpen(false);
                  setSelected(market);
                }}
                onClose={() => setCreateOpen(false)}
              />
            </PageScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={Boolean(selected)}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <SafeAreaView style={s.page}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelected(null)}
            style={[s.close, { paddingHorizontal: 16 }]}
          >
            <Text style={s.text}>Close research ✕</Text>
          </Pressable>
          <PageScrollView contentContainerStyle={s.body}>
            {selected && (
              <ParlayResearch
                market={selected}
                added={slip.some(
                  (m) => m.id === selected.id && m.sportsbook === selected.sportsbook,
                )}
                onAdd={(market) =>
                  setSlip((current) =>
                    current.some((m) => m.id === market.id && m.sportsbook === market.sportsbook)
                      ? current.filter(
                          (m) => !(m.id === market.id && m.sportsbook === market.sportsbook),
                        )
                      : [...current, market],
                  )
                }
              />
            )}
          </PageScrollView>
        </SafeAreaView>
      </Modal>
    </PageScrollView>
  );
}
function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={s.stat}>
      <Text
        style={{
          fontFamily: 'BarlowCondensed',
          fontSize: 28,
          lineHeight: 28,
          color: '#f4f8fc',
          marginBottom: 5,
        }}
      >
        {value}
      </Text>
      <Text style={s.value}>{label}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  teamCard: {
    width: '48%',
    padding: 16,
    borderWidth: 1,
    borderColor: '#183b4c',
    borderRadius: 8,
    gap: 8,
  },
  page: { flex: 1, backgroundColor: '#00121b' },
  body: { padding: 16, paddingBottom: 32 },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 15,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#183b4c',
    borderRadius: 7,
    backgroundColor: '#031923',
  },
  stat: { width: '50%', paddingHorizontal: 16, borderRightWidth: 1, borderColor: '#183b4c' },
  values: { flexDirection: 'row', gap: 16, marginTop: 24 },
  value: { color: '#9db4c6', fontFamily: 'BarlowCondensed', fontSize: 13, lineHeight: 17 },
  heading: { color: 'white', fontSize: 28, fontFamily: 'BarlowCondensed', marginVertical: 14 },
  title: { color: 'white', fontSize: 17, fontWeight: '800' },
  text: { color: 'white', fontSize: 15, lineHeight: 22 },
  muted: { color: '#9db4c6', fontSize: 12, lineHeight: 20, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#34505F',
    padding: 14,
    color: 'white',
    borderRadius: 8,
    marginBottom: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: '#183b4c',
    backgroundColor: '#031923',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  line: { fontSize: 13, fontWeight: '800' },
  close: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
});
