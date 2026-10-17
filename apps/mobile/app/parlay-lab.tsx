import type { CatalogProgress } from '../../../packages/parlay/prop-catalog';
import { usePropMarketNavigation } from '../lib/prop-market-navigation';
import { PropDiscoveryTable, PropMarketNavigation } from '../components/prop-discovery-table';
import { formatStatValue } from '../../../packages/parlay/stat-display';
import {
  PROP_CATEGORIES,
  PROP_SORTS,
  matchesPropCategory,
  type PropCatalogPage,
} from '../../../packages/parlay/prop-catalog';
import { isAnytimeTD, propPick, researchSide } from '../../../packages/parlay/anytime-td';
import { formatProjection } from '../../../packages/parlay/projection-display';
import { labScoreColor } from '../../../packages/parlay/lab-score-config';
import { matchesPropSearch } from '../../../packages/parlay/search';
import { LabScoreHelp } from '../components/lab-score-help';
import { ParlaySlip } from '../components/parlay-slip';
import { addSlipLeg } from '../../../packages/parlay/slip';
import { useAuth } from '../lib/auth-context';
import { largeDeviceStorage } from '../lib/large-device-storage';
import { useDiscoveryPreferences } from '../lib/parlay-discovery-preferences';
import { ParlayDiscoveryControls } from '../components/parlay-discovery-controls';
import {
  discoveryLineMode,
  selectDiscoveryMarkets,
} from '../../../packages/parlay/discovery-selection';
import { labScoreBand } from '../../../packages/parlay/lab-score-config';
import { ParlayGenerator } from '../components/parlay-generator';
import { ParlayIcon } from '../components/parlay-icon';
import { ParlayHomeHero, ParlayAltPromotion, ParlayMovers } from '../components/parlay-home-panels';
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
  const discovery = useDiscoveryPreferences();
  const {
    eventId,
    view: routeView,
    category: routeCategory,
  } = useLocalSearchParams<{ eventId?: string; view?: string; category?: string }>();
  const { teamId } = useTeamBranding();
  const colors = getEditorialHeroTheme(teamId);
  const [createOpen, setCreateOpen] = useState(false);
  const [events, setEvents] = useState<ParlayEvent[]>([]),
    [markets, setMarkets] = useState<ParlayMarket[]>([]);
  const [section, setSection] = useState<
    | 'home'
    | 'all-props'
    | 'games'
    | 'players'
    | 'trends'
    | 'teams'
    | 'generator'
    | 'alt-stack'
    | 'my-plays'
    | 'settings'
  >(() =>
    routeView === 'trends'
      ? 'trends'
      : routeView === 'all-props' || (!routeView && routeCategory)
        ? 'all-props'
        : 'home',
  );
  const [catalog, setCatalog] = useState<PropCatalogPage | null>(null);
  const [progress, setProgress] = useState<CatalogProgress>();
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogSort, setCatalogSort] = useState('score');
  const [researchTeam, setResearchTeam] = useState('ALL');
  const [localMarketFilter, setLocalMarketFilter] = useState('ALL');
  const navigation = usePropMarketNavigation(
    section,
    catalog?.progress?.complete === false ? undefined : catalog?.facets,
  );
  const groupedNavigation = section === 'all-props' || section === 'trends';
  const marketFilter = groupedNavigation ? navigation.category : localMarketFilter;
  const specificMarket = groupedNavigation ? navigation.market : 'ALL';
  const setMarketFilter = (value: string) =>
    groupedNavigation ? navigation.onCategory(value) : setLocalMarketFilter(value);
  const setSpecificMarket = (value: string) => {
    if (groupedNavigation) navigation.onMarket(value);
  };
  useEffect(() => {
    if (routeView === 'all-props' || routeView === 'trends') setSection(routeView);
  }, [routeView]);
  const [sideFilter, setSideFilter] = useState('ALL'),
    [bookFilter, setBookFilter] = useState('ALL'),
    [myTeamOnly, setMyTeamOnly] = useState(false);
  const [event, setEvent] = useState('ALL'),
    [search, setSearch] = useState(''),
    [selected, setSelected] = useState<ParlayMarket | null>(null);
  useEffect(() => {
    if (eventId) {
      setEvent(eventId);
      if (!routeView && !routeCategory) setSection('home');
    }
  }, [eventId, routeView, routeCategory]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [slip, setSlip] = useState<ParlayMarket[]>([]);
  const { user } = useAuth();
  const activeKey = `dd-native-parlay-current-${user?.id ?? 'guest'}`;
  const [loadedKey, setLoadedKey] = useState('');
  useEffect(() => {
    let active = true;
    setLoadedKey('');
    setSlip([]);
    void largeDeviceStorage
      .get(activeKey)
      .then((raw) => {
        if (active) {
          const value = JSON.parse(raw ?? '[]');
          setSlip(Array.isArray(value) ? value : []);
          setLoadedKey(activeKey);
        }
      })
      .catch(() => {
        if (active) setLoadedKey(activeKey);
      });
    return () => {
      active = false;
    };
  }, [activeKey]);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    if (loadedKey === activeKey)
      writes.current = writes.current
        .then(() => largeDeviceStorage.set(activeKey, JSON.stringify(slip)))
        .catch(() => {});
  }, [slip, loadedKey, activeKey]);
  const request = useRef(0);
  const isAllProps = section === 'all-props';
  const groupedDiscovery = isAllProps || section === 'trends';
  const catalogQuery = groupedDiscovery
    ? new URLSearchParams({
        page: String(catalogPage),
        grouped: 'true',
        view: section,
        market: specificMarket,
        sort: catalogSort,
        game: event,
        team: myTeamOnly ? teamId : researchTeam,
        category: marketFilter,
        search,
        side: sideFilter,
        book: bookFilter,
        altLines: String(discovery.altLines),
        maxOdds: String(discovery.maxOdds),
      }).toString()
    : '';
  useEffect(
    () => setCatalogPage(1),
    [
      catalogSort,
      event,
      researchTeam,
      myTeamOnly,
      teamId,
      marketFilter,
      specificMarket,
      section,
      search,
      sideFilter,
      bookFilter,
      discovery.altLines,
      discovery.maxOdds,
    ],
  );
  const isAltStack = section === 'alt-stack';
  const load = useCallback(async () => {
    if (!discovery.ready) return;
    const id = ++request.current;
    setLoading(true);
    setError('');
    try {
      const [games, research] = await Promise.all([
        groupedDiscovery ? Promise.resolve(null) : getParlayEvents(),
        groupedDiscovery
          ? authenticatedFetch(`/api/parlay-lab/props?${catalogQuery}`).then(async (r) => {
              if (!r.ok)
                throw new Error('Available props could not be loaded. Pull down to retry.');
              return r.json() as Promise<PropCatalogPage>;
            })
          : isAltStack
            ? authenticatedFetch('/api/parlay-lab/alt-stack').then(async (r) => {
                if (!r.ok) throw new Error('Alt Stack is unavailable. Pull down to retry.');
                return r.json() as Promise<{ markets: ParlayMarket[] }>;
              })
            : getParlayMarkets(event, discovery.altLines ? 'all' : 'standard'),
      ]);
      const loadedEvents = groupedDiscovery ? (research as PropCatalogPage).events : games?.events;
      if (!Array.isArray(loadedEvents) || !Array.isArray(research.markets))
        throw new Error('Research data is unavailable. Pull down to retry.');
      if (id !== request.current) return;
      if (groupedDiscovery) setCatalog(research as PropCatalogPage);
      setProgress((research as { progress?: CatalogProgress }).progress);
      setEvents(loadedEvents);
      setMarkets(research.markets);
    } catch (e) {
      if (id === request.current) {
        setError(e instanceof Error ? e.message : 'Unable to load research.');
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [event, isAltStack, groupedDiscovery, catalogQuery, discovery.ready, discovery.altLines]);
  useEffect(() => {
    if (progress?.complete !== false || error) return;
    const timer = setTimeout(() => void load(), 1000);
    return () => clearTimeout(timer);
  }, [progress, load, error]);
  useEffect(() => {
    if (!groupedDiscovery) setMarkets([]);
    setLoading(true);
    const timer = setTimeout(() => void load(), groupedDiscovery && search.trim() ? 200 : 0);
    return () => {
      clearTimeout(timer);
      request.current++;
    };
  }, [load, groupedDiscovery, search]);
  const visible = useMemo(() => {
    if (groupedDiscovery) return markets;
    const rows = markets.filter(
      (m) =>
        m.available &&
        (sideFilter === 'ALL' || researchSide(m.side) === sideFilter) &&
        (bookFilter === 'ALL' || m.sportsbook === bookFilter) &&
        (!myTeamOnly || m.teamId === teamId) &&
        (researchTeam === 'ALL' || m.teamId === researchTeam) &&
        matchesPropCategory(m, marketFilter) &&
        matchesPropSearch(
          `${m.playerName ?? m.teamId} ${isAnytimeTD(m) ? 'Anytime TD' : label(m.marketType)}`,
          search,
        ),
    );
    return selectDiscoveryMarkets(
      rows,
      { altLines: discovery.altLines, maxOdds: discovery.maxOdds },
      {
        includeUnqualified: !['trends', 'home'].includes(section),
      },
    );
  }, [
    groupedDiscovery,
    discovery.altLines,
    discovery.maxOdds,
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
    <View style={{ flex: 1, backgroundColor: '#00141e' }}>
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
              'all-props',
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
                ? 'Home'
                : key === 'all-props'
                  ? 'All Props'
                  : key === 'trends'
                    ? 'Trending Props'
                    : key === 'my-plays'
                      ? 'My Parlays'
                      : key === 'generator'
                        ? 'Parlay Generator'
                        : key === 'alt-stack'
                          ? 'Alt Stack'
                          : key[0].toUpperCase() + key.slice(1),
            selected: section === key,
            onPress: () => {
              setSection(key);
              router.setParams({ view: key });
            },
          }))}
        />
        {section === 'trends' && (
          <View style={s.card}>
            <Text style={s.heading}>TRENDING PROPS</Text>
            <Text style={s.text}>REAL DATA. REAL TRENDS. BET SMARTER.</Text>
            {(catalog?.featured ?? []).map((m, index) => (
              <Pressable
                key={`${m.id}:${m.sportsbook}`}
                accessibilityRole="button"
                onPress={() => setSelected(m)}
                style={s.card}
              >
                <Text style={s.muted}>#{index + 1} TRENDING</Text>
                <Text style={s.title}>{m.playerName}</Text>
                <Text style={s.text}>
                  {propPick(m)} {isAnytimeTD(m) ? 'Anytime TD' : label(m.marketType)} · Lab Score{' '}
                  {m.trend?.trendScore ?? '—'}
                </Text>
                <Text style={s.text}>View Prop →</Text>
              </Pressable>
            ))}
          </View>
        )}
        {isAllProps && (
          <View style={s.card}>
            <Text style={s.heading}>ALL PROPS</Text>
            <Text style={s.text}>EVERY LINE. EVERY PLAYER. BET SMARTER.</Text>
            <Text style={s.muted}>
              Explore NFL player props, compare sportsbook odds, evaluate Lab Scores, and build your
              perfect parlay.
            </Text>
            <View style={s.stats}>
              <Stat value={catalog?.stats.props ?? '—'} label="AVAILABLE PROPS" />
              <Stat value={catalog?.stats.players ?? '—'} label="PLAYERS" />
              <Stat value={catalog?.stats.games ?? '—'} label="GAMES" />
              <Stat value={catalog?.stats.highestScore ?? '—'} label="HIGHEST LAB SCORE" />
            </View>
          </View>
        )}
        {section === 'home' && (
          <View style={s.stats}>
            <Pressable accessibilityRole="button" onPress={() => setSection('all-props')}>
              <Text style={s.text}>Explore All Props →</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setSection('trends')}>
              <Text style={s.text}>View Trending Props →</Text>
            </Pressable>
          </View>
        )}
        {section === 'home' && (
          <View style={s.stats}>
            <Stat value={markets.filter((m) => m.available).length} label="ACTIVE PROPS" />
            <Stat value={selectDiscoveryMarkets(markets, discovery).length} label="TRENDING NOW" />
            <Stat
              value={markets.filter((m) => (m.trend?.trendScore ?? 0) >= 90).length}
              label="90+ LAB SCORES"
            />
            <Stat value={events.length} label="GAMES ON BOARD" />
          </View>
        )}
        {section === 'home' && (
          <ParlayHomeHero teamId={teamId} markets={markets} events={events} onOpen={setSelected} />
        )}
        {progress?.complete === false && (
          <Text accessibilityRole="text" style={s.muted}>
            Loading more games… {progress.loadedEvents} of {progress.totalEvents} loaded. Results
            and rankings are still updating.
          </Text>
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
              Your selected team personalizes highlights. NFL-wide research remains available on
              every page.
            </Text>
            <Pressable style={s.close} onPress={() => setSection('teams')}>
              <Text style={s.text}>Change team →</Text>
            </Pressable>
          </View>
        ) : section === 'alt-stack' ? (
          <ParlayAltStack events={events} slip={slip} setSlip={setSlip} onOpen={setSelected} />
        ) : section === 'players' || section === 'teams' ? (
          <ParlayPlayers
            key={section}
            mode={section}
            initialTeam={teamId}
            markets={markets}
            onOpen={setSelected}
          />
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
                  : isAllProps
                    ? 'All Props'
                    : 'PLAYER PROPS'}
            </Text>
            {groupedDiscovery ? (
              <PropMarketNavigation
                facets={catalog?.facets ?? []}
                category={marketFilter}
                market={specificMarket}
                onCategory={(value) => {
                  setMarketFilter(value);
                  setCatalogPage(1);
                }}
                onMarket={(value) => {
                  setSpecificMarket(value);
                  setCatalogPage(1);
                }}
                accent={colors.heroPrimaryAccent}
              />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                {PROP_CATEGORIES.map(([value, title]) => (
                  <Pressable
                    key={value}
                    onPress={() => {
                      setMarketFilter(value);
                    }}
                    style={{
                      padding: 10,
                      borderRadius: 3,
                      backgroundColor:
                        marketFilter === value ? colors.heroPrimaryAccent : '#092532',
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 10 }}>{title}</Text>
                  </Pressable>
                ))}
              </View>
            )}
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
            {!groupedDiscovery && (
              <SectionMenu
                dark
                title={marketFilter === 'ALL' ? 'All markets' : label(marketFilter)}
                items={['ALL', ...new Set(markets.map((m) => m.marketType))].map((value) => ({
                  label: value === 'ALL' ? 'All markets' : label(value),
                  selected: marketFilter === value,
                  onPress: () => setMarketFilter(value),
                }))}
              />
            )}
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
                  items={[
                    'ALL',
                    ...(groupedDiscovery
                      ? (catalog?.books ?? [])
                      : [...new Set(markets.map((m) => m.sportsbook))]),
                  ].map((v) => ({
                    label: v,
                    onPress: () => setBookFilter(v),
                    selected: v === bookFilter,
                  }))}
                />
              </View>
            </View>
            {groupedDiscovery && (
              <SectionMenu
                dark
                title={PROP_SORTS.find(([id]) => id === catalogSort)?.[1] ?? 'Sort props'}
                items={PROP_SORTS.map(([id, title]) => ({
                  label: title,
                  selected: catalogSort === id,
                  onPress: () => setCatalogSort(id),
                }))}
              />
            )}
            <ParlayDiscoveryControls myTeamOnly={myTeamOnly} onTeamChange={setMyTeamOnly} />
            <TextInput
              accessibilityLabel="Search players and markets"
              placeholder="Search players or markets"
              placeholderTextColor="#A8BAC4"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={s.input}
            />
            {!loading && !error && !visible.length && (
              <Text style={s.muted}>
                {isAllProps && catalog?.stats.props === 0
                  ? 'No upcoming player props are currently available.'
                  : search.trim()
                    ? 'No props match your search with the current filters. Try another name or adjust the filters.'
                    : ['home', 'trends'].includes(section)
                      ? 'No props meet the current evidence and value requirements. Browse Games or Players for more research.'
                      : 'No props match this selection. Try another game or player.'}
              </Text>
            )}
            {!loading && !visible.length && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSearch('');
                  setMarketFilter('ALL');
                  setResearchTeam('ALL');
                  setEvent('ALL');
                  setBookFilter('ALL');
                  setSideFilter('ALL');
                  setMyTeamOnly(false);
                  discovery.update({ altLines: false });
                }}
              >
                <Text style={s.text}>Clear filters</Text>
              </Pressable>
            )}
            {groupedDiscovery && (catalog?.pages ?? 0) > 1 && (
              <View style={s.stats}>
                <Pressable
                  accessibilityRole="button"
                  disabled={loading || (catalog?.page ?? 1) <= 1}
                  onPress={() => setCatalogPage((catalog?.page ?? 1) - 1)}
                >
                  <Text style={s.text}>Previous</Text>
                </Pressable>
                <Text style={s.muted}>
                  Page {catalog?.page} of {catalog?.pages}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={loading || (catalog?.page ?? 1) >= (catalog?.pages ?? 1)}
                  onPress={() => setCatalogPage((catalog?.page ?? 1) + 1)}
                >
                  <Text style={s.text}>Next</Text>
                </Pressable>
              </View>
            )}
            {groupedDiscovery ? (
              <>
                <Text style={s.muted}>
                  {loading
                    ? catalog
                      ? 'Updating selections… Showing previous results.'
                      : 'Loading selections…'
                    : `${formatStatValue(catalog?.totalGroups ?? 0)} player/market groups · ${formatStatValue(catalog?.total ?? 0)} selections`}
                </Text>
                <PropDiscoveryTable
                  groups={catalog?.groups ?? []}
                  events={events}
                  slip={slip}
                  onOpen={setSelected}
                  onAdd={(m) => setSlip((current) => addSlipLeg(current, m))}
                  accent={colors.heroPrimaryAccent}
                />
              </>
            ) : (
              visible.slice(0, 100).map((m) => (
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
                        {m.teamId} · {isAnytimeTD(m) ? 'Anytime TD' : label(m.marketType)}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${m.playerName ?? 'prop'} to parlay`}
                      onPress={(e) => {
                        e.stopPropagation();
                        setSlip((current) =>
                          current.some((x) => x.id === m.id && x.sportsbook === m.sportsbook)
                            ? current.filter(
                                (x) => !(x.id === m.id && x.sportsbook === m.sportsbook),
                              )
                            : addSlipLeg(current, m),
                        );
                      }}
                      style={{ padding: 12, backgroundColor: '#12313F', borderRadius: 4 }}
                    >
                      <Text style={{ color: 'white' }}>
                        {slip.some((x) => x.id === m.id && x.sportsbook === m.sportsbook)
                          ? '✓'
                          : '+'}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
                    {[
                      [
                        'PROP',
                        `${propPick(m)} ${isAnytimeTD(m) ? 'Anytime TD' : label(m.marketType)}${m.lineType === 'alternate' ? ' · ALT LINE' : ''}`,
                      ],
                      [
                        'GAME',
                        events.find((e) => e.id === m.eventId)
                          ? `${events.find((e) => e.id === m.eventId)!.awayTeamId} @ ${events.find((e) => e.id === m.eventId)!.homeTeamId}`
                          : '—',
                      ],
                      ['LINE', propPick(m)],
                      ['ODDS', m.odds == null ? '—' : `${m.odds > 0 ? '+' : ''}${m.odds}`],
                      [
                        'LAB SCORE',
                        m.trend && m.trend.projection?.estimatedProbability != null
                          ? `${Math.round(m.trend.trendScore)} · ${labScoreBand(m.trend.trendScore).label}`
                          : '—',
                      ],
                      ['PROJECTION', formatProjection(m)],
                      ['L/10', m.trend ? `${m.trend.last10.hits}/${m.trend.last10.games}` : '—'],
                    ].map(([label, value]) => (
                      <View key={label} style={{ width: '29%' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ color: '#7E99AA', fontSize: 9, letterSpacing: 1 }}>
                            {label}
                          </Text>
                          {label === 'LAB SCORE' && <LabScoreHelp />}
                        </View>
                        <Text
                          style={{
                            color:
                              label === 'LAB SCORE'
                                ? labScoreColor(value === '—' ? null : m.trend?.trendScore)
                                : '#E2EBF0',
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
              ))
            )}
            {!groupedDiscovery && visible.length > 100 && (
              <Text style={s.muted}>
                Showing 100 of {visible.length} props. Search or choose a game to narrow the
                results.
              </Text>
            )}
          </>
        )}
        {section === 'home' && <ParlayMovers />}
        {section === 'home' && <ParlayAltPromotion onGenerate={() => setSection('alt-stack')} />}
        {['my-plays', 'generator'].includes(section) && (
          <ParlayBuild
            events={events}
            section={section}
            teamId={teamId}
            slip={slip}
            setSlip={setSlip}
            onOpen={setSelected}
          />
        )}
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
                        : addSlipLeg(current, market),
                    )
                  }
                />
              )}
            </PageScrollView>
          </SafeAreaView>
        </Modal>
      </PageScrollView>
      <ParlaySlip
        legs={slip}
        markets={markets}
        accent={colors.heroPrimaryAccent}
        setLegs={setSlip}
        events={events}
        onOpen={setSelected}
      />
    </View>
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
        {formatStatValue(value)}
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
