'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FlaskConical,
  Plus,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import { TEAM_LIST } from '@/data/teams';
import { sportsbookName } from '@/server/odds/sportsbooks';
import { generateResearchSlip, parseResearchPrompt } from '@/lib/parlay-lab/research';
import { ladderDescriptionUnit, marketDisplayName } from '@/lib/parlay-lab/market-display';
import { buildSportsbookLink, type Market } from './ParlayLabPage';
import PlayerAvatar from './PlayerAvatar';
import { isLabPickMarket, matchesTrendingMarketFilter } from './trending-market-filter';
import MyParlayPanel from './MyParlayPanel';
import ParlayLabSecondaryNav from './ParlayLabSecondaryNav';
import ParlaySortHeader from './ParlaySortHeader';
import {
  americanOddsToDecimal,
  hitRateSortValue,
  matchesOddsFilter,
  nextSort,
  sortTableRows,
  type OddsFilter,
  type SortState,
} from './parlay-table';
import styles from './parlay-home.module.css';

const GameByGameTrendChart = dynamic(() => import('./charts/GameByGameTrendChart'), { ssr: false });
const LineLadderChart = dynamic(() => import('./charts/LineLadderChart'), { ssr: false });
const OpponentVsPositionChart = dynamic(() => import('./charts/OpponentVsPositionChart'), {
  ssr: false,
});
const ResultDistributionChart = dynamic(() => import('./charts/ResultDistributionChart'), {
  ssr: false,
});

type Trend = {
  last5: { games: number; hits: number; hitRate: number | null };
  last10: { games: number; hits: number; hitRate: number | null };
  season: { games: number; hits: number; hitRate: number | null };
  last2Years: { games: number; hits: number; hitRate: number | null };
  vsOpponent: { games: number; hits: number; hitRate: number | null; average: number | null };
  home: { games: number; hits: number; hitRate: number | null; average: number | null };
  away: { games: number; hits: number; hitRate: number | null; average: number | null };
  average: number | null;
  median: number | null;
  recentAverage5: number | null;
  recentAverage10: number | null;
  max: number | null;
  streakType: string | null;
  streakLength: number;
  trendScore: number;
  sampleConfidence: string;
  gameLog: Array<{
    date: string;
    opponent: string;
    homeAway: string;
    statValue: number;
    line: number;
    result: string;
  }>;
};
type HomeMarket = Market & { trend?: Trend | null; eventId?: string };
type EnvironmentSplit = {
  games: number;
  hits: number;
  hitRate: number | null;
  average: number | null;
  median: number | null;
  averageMargin: number | null;
  sampleConfidence: string;
};
type VenueSplits = {
  indoor: EnvironmentSplit;
  outdoor: EnvironmentSplit;
  unknown: { games: number };
};
type ResearchDetail = {
  market: { opponentId: string | null; statType: string };
  summary: Trend;
  gameByGame: Array<{
    gameId: string;
    date: string;
    season: number;
    week: number;
    opponent: string;
    homeAway: string;
    value: number;
    line: number;
    result: string;
    margin: number;
    targets: number | null;
    opponentSeasonStrength: {
      season: number;
      passDefenseRank: number;
      rushDefenseRank: number;
      scoringDefenseRank: number;
      totalDefenseRank: number;
    } | null;
    environment: {
      gameWindow: string;
      restDays: number | null;
      restBucket: string;
    };
    venue: { environment: string };
  }>;
  lineLadder: {
    rows: Array<{
      threshold: number;
      displayThreshold: string;
      last5: { hits: number; games: number; hitRate: number | null };
      last10: { hits: number; games: number; hitRate: number | null };
      season: { hits: number; games: number; hitRate: number | null };
      last2Years: { hits: number; games: number; hitRate: number | null };
      hitRate: number | null;
      averageMargin: number | null;
      fanduelPrice: number | null;
      draftkingsPrice: number | null;
      isCurrentLine: boolean;
      isAvailable: boolean;
      markets: HomeMarket[];
    }>;
    ladderSweetSpot: string | null;
  };
  lineLadderInsight: string | null;
  environment: {
    currentGame: {
      gameWindow: string;
      isPrimetime: boolean;
      primetimeType: string | null;
      dayNight: 'DAY' | 'NIGHT';
      restDays: number | null;
      restBucket: string;
    };
    splits: Record<string, EnvironmentSplit>;
    relevantSplits: Array<{ key: string; label: string; value: EnvironmentSplit }>;
    insights: Array<{ label: string; text: string }>;
  };
  usage: {
    primaryMetric: string;
    last3: number | null;
    last5: number | null;
    previous5: number | null;
    last10: number | null;
    trendPct: number | null;
    trendLabel: string | null;
    series: Array<{ date: string; value: number }>;
  };
  lineMargin: {
    average: number | null;
    median: number | null;
    averageMargin: number | null;
    medianMargin: number | null;
    averageHitMargin: number | null;
    clearByBuckets: Array<{ amount: number; hits: number; games: number }>;
    label: string | null;
    games: number;
  };
  consistency: {
    score: number;
    label: string;
    middle50Range: [number, number];
    withinMiddle50: number;
    games: number;
    outlierCount: number;
  } | null;
  gameScript: {
    spread: number;
    total: number | null;
    teamRole: string;
    scriptBucket: string;
    totalBucket: string | null;
    relevantInsight: string;
  } | null;
  venue: {
    current: {
      stadium: string | null;
      roofType: string;
      environment: 'INDOOR' | 'OUTDOOR' | 'UNKNOWN';
      statusKnown: boolean;
    };
    splits: VenueSplits;
    windows: {
      last5: VenueSplits;
      last10: VenueSplits;
      season: VenueSplits;
      twoYear: VenueSplits;
    };
    relevantInsight: string | null;
  };
  opponentVsPosition: {
    label: string;
    qualification: string;
    last5: { hits: number; games: number };
    last10: {
      hits: number;
      games: number;
      hitRate: number | null;
      average: number | null;
      median: number | null;
    };
    season: { hits: number; games: number };
    last2Years: { hits: number; games: number };
    sampleConfidence: string;
    recentResults: Array<{
      gameId: string;
      week: number;
      opponent: string;
      value: number;
      result: string;
    }>;
  } | null;
  distribution: {
    sampleSize: number;
    bins: Array<{ label: string; games: number; percentage: number }>;
  };
  missContext: {
    missContextScore: number | null;
    averageRelevantDefenseRank: number | null;
    misses: Array<{
      opponent: string;
      statValue: number;
      opponentRelevantDefenseRank: number | null;
    }>;
  };
  currentOpponentStrength: {
    season: number;
    defenseContext: 'PASS' | 'RUSH' | 'TOTAL' | 'SCORING';
    defenseLabel: string;
    rank: number;
  } | null;
  upcomingMatchup: {
    opponentTeamId: string;
    opponentAbbreviation: string;
    opponentName: string;
    relevantDefenseType: 'PASS' | 'RUSH' | 'TOTAL' | 'SCORING';
    defenseLabel: string;
    defenseSeason: number;
    defenseRank: number;
    relevantMetricName: string;
    relevantMetricValue: number;
    matchupLabel: string;
  } | null;
  generatedInsight: string | null;
  labMatchScore: number;
};

type OddsEvent = {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string;
};
const formatOdds = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : ''}${n}`);
const marketLabel = (m: Market) =>
  m.marketType
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (x) => x.toUpperCase());
const pickLabel = (m: Market) =>
  `${m.side === 'OVER' ? 'O' : m.side === 'UNDER' ? 'U' : m.side} ${m.line ?? ''}`.trim();
const playerTeamColor = (market: Pick<HomeMarket, 'teamId'>) =>
  TEAM_LIST.find((team) => team.abbr === market.teamId)?.colors[0] ?? null;
const TRENDING_PAGE_SIZE = 12;
type TrendingSortKey =
  | 'player'
  | 'market'
  | 'last10'
  | 'hitRate'
  | 'average'
  | 'opponent'
  | 'odds'
  | 'score';

export function ParlayLabHome() {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<OddsEvent[]>([]),
    [eventId, setEventId] = useState(''),
    [markets, setMarkets] = useState<HomeMarket[]>([]),
    [trendingGameId, setTrendingGameId] = useState('ALL'),
    [trendingMarkets, setTrendingMarkets] = useState<HomeMarket[]>([]),
    [slip, setSlip] = useState<HomeMarket[]>([]),
    [prompt, setPrompt] = useState(''),
    [filter, setFilter] = useState('ALL'),
    [oddsFilter, setOddsFilter] = useState<OddsFilter>('ALL'),
    [oddsMinimum, setOddsMinimum] = useState<number | null>(null),
    [oddsMaximum, setOddsMaximum] = useState<number | null>(null),
    [trendingSort, setTrendingSort] = useState<SortState<TrendingSortKey>>(null),
    [trendingPage, setTrendingPage] = useState(1),
    [message, setMessage] = useState(''),
    [detail, setDetail] = useState<HomeMarket | null>(null),
    [detailData, setDetailData] = useState<ResearchDetail | null>(null),
    [chartWindow, setChartWindow] = useState<'L5' | 'L10' | 'SEASON' | '2 YEARS'>('L10');
  useEffect(() => {
    const view = searchParams?.get('view');
    if (view === 'lab-finds') setFilter('LAB_FINDS');
    else if (view === 'trends') setFilter('ALL');
  }, [searchParams]);
  useEffect(() => {
    fetch('/api/parlay-lab/events')
      .then((r) => r.json())
      .then((b) => {
        const rows = (b.events ?? []) as OddsEvent[];
        setEvents(rows);
        setEventId(rows[0]?.id ?? '');
      })
      .catch(() => setMessage('Local odds are unavailable.'));
  }, []);
  useEffect(() => {
    if (!eventId) return;
    setMarkets([]);
    fetch(`/api/parlay-lab/research?eventId=${encodeURIComponent(eventId)}`)
      .then((r) => r.json())
      .then((b) => setMarkets((b.markets ?? []).filter((m: HomeMarket) => m.available)))
      .catch(() => setMessage('Markets for this game could not be loaded.'));
  }, [eventId]);
  useEffect(() => {
    if (!events.length) return;
    const controller = new AbortController();
    setTrendingMarkets([]);
    fetch(`/api/parlay-lab/research?eventId=${encodeURIComponent(trendingGameId)}`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((body) =>
        setTrendingMarkets((body.markets ?? []).filter((market: HomeMarket) => market.available)),
      )
      .catch((error) => {
        if (error.name !== 'AbortError') setMessage('Trending markets could not be loaded.');
      });
    return () => controller.abort();
  }, [events.length, trendingGameId]);
  useEffect(
    () => setTrendingPage(1),
    [filter, oddsFilter, oddsMinimum, oddsMaximum, trendingGameId, trendingSort],
  );
  const allRows = useMemo(() => {
    const unique = new Map<string, HomeMarket>();
    for (const m of trendingMarkets) {
      const key = `${m.eventId ?? trendingGameId}:${m.normalizedKey}`;
      const old = unique.get(key);
      if (!old || (m.odds ?? -9999) > (old.odds ?? -9999)) unique.set(key, m);
    }
    const filtered = [...unique.values()]
      .filter((m) =>
        filter === 'LAB_FINDS' ? isLabPickMarket(m) : matchesTrendingMarketFilter(m, filter),
      )
      .filter((market) => matchesOddsFilter(market.odds, oddsFilter, oddsMinimum, oddsMaximum))
      .sort((a, b) => (b.trend?.trendScore ?? -1) - (a.trend?.trendScore ?? -1));
    if (trendingSort)
      return sortTableRows(filtered, trendingSort, {
        player: (market) => (market.playerName ?? market.teamId ?? '').toLowerCase(),
        market: (market) => marketLabel(market).toLowerCase(),
        last10: (market) =>
          market.trend
            ? hitRateSortValue(market.trend.last10.hits, market.trend.last10.games)
            : null,
        hitRate: (market) =>
          market.trend
            ? hitRateSortValue(market.trend.last10.hits, market.trend.last10.games)
            : null,
        average: (market) => market.trend?.average,
        opponent: (market) =>
          market.trend
            ? hitRateSortValue(market.trend.vsOpponent.hits, market.trend.vsOpponent.games)
            : null,
        odds: (market) => (market.odds == null ? null : americanOddsToDecimal(market.odds)),
        score: (market) => market.trend?.trendScore,
      });
    if (trendingGameId !== 'ALL' || filter !== 'ALL') return filtered;

    const selected: HomeMarket[] = [];
    const addOnce = (market: HomeMarket | undefined) => {
      if (market && !selected.some((item) => item.id === market.id)) selected.push(market);
    };
    for (const category of ['PASSING', 'RUSHING', 'RECEIVING', 'TOUCHDOWN'])
      addOnce(filtered.find((market) => matchesTrendingMarketFilter(market, category)));
    for (const market of filtered) {
      const sameGame = selected.filter((item) => item.eventId === market.eventId).length;
      if (sameGame < 2) addOnce(market);
    }
    for (const market of filtered) {
      addOnce(market);
    }
    return selected;
  }, [trendingMarkets, filter, trendingGameId, oddsFilter, oddsMinimum, oddsMaximum, trendingSort]);
  const trendingPageCount = Math.max(1, Math.ceil(allRows.length / TRENDING_PAGE_SIZE));
  useEffect(
    () => setTrendingPage((page) => Math.min(page, trendingPageCount)),
    [trendingPageCount],
  );
  const rows = allRows.slice(
    (trendingPage - 1) * TRENDING_PAGE_SIZE,
    trendingPage * TRENDING_PAGE_SIZE,
  );
  const add = (m: HomeMarket) =>
    setSlip((s) => (s.some((x) => x.id === m.id && x.sportsbook === m.sportsbook) ? s : [...s, m]));
  const openResearch = (market: HomeMarket) => {
    setDetail(market);
    setDetailData(null);
    setChartWindow('L10');
    const query = new URLSearchParams({
      eventId: market.eventId ?? eventId,
      playerId: market.playerId ?? '',
      marketType: market.marketType,
      line: String(market.line),
      side: market.side,
    });
    fetch(`/api/parlay-lab/research?${query}`)
      .then((response) => response.json())
      .then(setDetailData)
      .catch(() => setMessage('Detailed research could not be loaded.'));
  };
  const generate = () => {
    const next = generateResearchSlip(markets, parseResearchPrompt(prompt)) as HomeMarket[];
    setSlip(next);
    const historical = next.filter((market) => market.trend);
    const sevenOfTen = historical.filter(
      (market) => market.trend!.last10.games >= 10 && market.trend!.last10.hits >= 7,
    );
    setMessage(
      next.length
        ? `${next.length} locally matched leg${next.length === 1 ? '' : 's'}; ${historical.length} ${historical.length === 1 ? 'has' : 'have'} qualifying historical data${sevenOfTen.length ? ` and ${sevenOfTen.length} hit in at least 7 of the last 10 games` : ''}.`
        : 'No imported markets matched every part of that request.',
    );
  };
  const oneBook =
    slip.length > 0 && slip.every((x) => x.sportsbook === slip[0]?.sportsbook)
      ? slip[0].sportsbook
      : null;
  const sportsbookLink = oneBook ? buildSportsbookLink(slip, oneBook) : null;
  return (
    <TeamThemeProvider>
      <div className={styles.shell}>
        <MainSiteHeader active="parlay-lab" tone="brand" />
        <ParlayLabSecondaryNav />
        <main className={styles.page}>
          <section className={styles.main}>
            <header className={styles.hero}>
              <div>
                <p>
                  <FlaskConical /> Down &amp; Distance Labs
                </p>
                <h1>
                  Parlay Lab <span>Beta</span>
                </h1>
                <h2>
                  Research. <b>Analyze. Build smarter parlays.</b>
                </h2>
                <small>Use imported odds and transparent local analysis before you bet.</small>
              </div>
              <div className={styles.values}>
                <article>
                  <Sparkles />
                  <b>Guided research</b>
                  <span>Describe the slip you want.</span>
                </article>
                <article>
                  <TrendingUp />
                  <b>Real markets</b>
                  <span>Browse actionable prices.</span>
                </article>
                <article>
                  <BarChart3 />
                  <b>Clear signals</b>
                  <span>Know what data supports.</span>
                </article>
              </div>
            </header>
            <section className={styles.ask}>
              <div>
                <Sparkles />
                <input
                  aria-label="Research prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && generate()}
                  placeholder="Let's cook-up a parlay"
                />
                <button onClick={generate}>Generate Parlay →</button>
              </div>
              <p>
                Try “Build a 3-leg Chiefs vs Broncos parlay” or “Find touchdown picks at plus
                money.”
              </p>
            </section>
            <section className={styles.panel} id="trending-props">
              <header>
                <h2>🏈 Featured Games</h2>
                <Link href={eventId ? `/parlay-lab/game/${eventId}/markets` : '/parlay-lab'}>
                  Browse markets →
                </Link>
              </header>
              <div className={styles.games}>
                {events.map((g) => (
                  <Link
                    key={g.id}
                    href={`/parlay-lab/game/${g.id}/markets`}
                    className={g.id === eventId ? styles.active : ''}
                    aria-label={`Open ${g.awayTeamId} at ${g.homeTeamId} game markets`}
                  >
                    <time>
                      {new Date(g.kickoffAt).toLocaleDateString([], {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>
                    <strong>
                      <span className={styles.gameTeam}>{g.awayTeamId}</span>
                      <i>@</i>
                      <span className={styles.gameTeam}>{g.homeTeamId}</span>
                    </strong>
                    <small>Week {g.week}</small>
                  </Link>
                ))}
              </div>
            </section>
            <section className={styles.panel} id="featured-games">
              <header>
                <div>
                  <h2>🔥 Trending Props</h2>
                  <p>Researchable props and stored prices from your latest local import.</p>
                </div>
                <Link href="/parlay-lab/trends">Research notes →</Link>
              </header>
              <div className={styles.trendingControls}>
                <nav className={styles.chips} aria-label="Trending prop category">
                  {['ALL', 'PASSING', 'RUSHING', 'RECEIVING', 'TOUCHDOWN', 'LAB_FINDS'].map((x) => (
                    <button
                      key={x}
                      className={`${x === 'LAB_FINDS' ? styles.labPickChip : ''} ${filter === x ? styles.activeChip : ''}`}
                      onClick={() => setFilter(x)}
                    >
                      {x === 'LAB_FINDS' && <FlaskConical />}
                      {x === 'ALL'
                        ? 'All'
                        : x === 'LAB_FINDS'
                          ? 'Lab Finds'
                          : x[0] + x.slice(1).toLowerCase()}
                    </button>
                  ))}
                </nav>
                <label className={styles.gameFilter}>
                  <span>Game</span>
                  <select
                    value={trendingGameId}
                    onChange={(event) => setTrendingGameId(event.target.value)}
                  >
                    <option value="ALL">All Games</option>
                    {events.map((game) => (
                      <option key={game.id} value={game.id}>
                        {game.awayTeamId} @ {game.homeTeamId} ·{' '}
                        {new Date(game.kickoffAt).toLocaleDateString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.gameFilter}>
                  <span>Odds</span>
                  <select
                    value={oddsFilter}
                    onChange={(event) => setOddsFilter(event.target.value as OddsFilter)}
                    title="Filters by sportsbook price only. It does not measure the likelihood of the bet winning."
                  >
                    <option value="ALL">All Odds</option>
                    <option value="-500">-500 or Better</option>
                    <option value="-300">-300 or Better</option>
                    <option value="-200">-200 or Better</option>
                    <option value="-150">-150 or Better</option>
                    <option value="-120">-120 or Better</option>
                    <option value="PLUS">Plus Money</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </label>
                {oddsFilter === 'CUSTOM' ? (
                  <div className={styles.customOdds}>
                    <input
                      aria-label="Minimum odds"
                      inputMode="numeric"
                      placeholder="Min"
                      onChange={(event) =>
                        setOddsMinimum(event.target.value ? Number(event.target.value) : null)
                      }
                    />
                    <span>to</span>
                    <input
                      aria-label="Maximum odds"
                      inputMode="numeric"
                      placeholder="Max"
                      onChange={(event) =>
                        setOddsMaximum(event.target.value ? Number(event.target.value) : null)
                      }
                    />
                  </div>
                ) : null}
              </div>
              <div className={styles.table}>
                <div className={styles.head}>
                  <ParlaySortHeader
                    label="Player / team"
                    sortKey="player"
                    sort={trendingSort}
                    onSort={(key) => setTrendingSort((sort) => nextSort(sort, key))}
                  />
                  <ParlaySortHeader
                    label="Market"
                    sortKey="market"
                    sort={trendingSort}
                    onSort={(key) => setTrendingSort((sort) => nextSort(sort, key))}
                  />
                  <ParlaySortHeader
                    label="Last 10"
                    sortKey="last10"
                    sort={trendingSort}
                    onSort={(key) => setTrendingSort((sort) => nextSort(sort, key))}
                  />
                  <ParlaySortHeader
                    label="Hit rate"
                    sortKey="hitRate"
                    sort={trendingSort}
                    onSort={(key) => setTrendingSort((sort) => nextSort(sort, key))}
                  />
                  <ParlaySortHeader
                    label="Average"
                    sortKey="average"
                    sort={trendingSort}
                    onSort={(key) => setTrendingSort((sort) => nextSort(sort, key))}
                  />
                  <ParlaySortHeader
                    label="Vs. Opponent"
                    sortKey="opponent"
                    sort={trendingSort}
                    onSort={(key) => setTrendingSort((sort) => nextSort(sort, key))}
                  />
                  <ParlaySortHeader
                    label="Odds"
                    sortKey="odds"
                    sort={trendingSort}
                    onSort={(key) => setTrendingSort((sort) => nextSort(sort, key))}
                    title="Best currently stored price across selected sportsbooks."
                  />
                  <ParlaySortHeader
                    label="Score"
                    sortKey="score"
                    sort={trendingSort}
                    onSort={(key) => setTrendingSort((sort) => nextSort(sort, key))}
                    title="Parlay Lab research score. This is not a predicted win probability."
                  />
                  <span />
                </div>
                {rows.map((m) => (
                  <div
                    className={styles.row}
                    key={`${m.id}-${m.sportsbook}`}
                    onClick={() => openResearch(m)}
                  >
                    <strong className={styles.playerCell}>
                      <PlayerAvatar
                        name={m.playerName}
                        headshotUrl={m.headshotUrl}
                        teamColor={playerTeamColor(m)}
                      />
                      <span>{m.playerName ?? m.teamId ?? 'Game'}</span>
                    </strong>
                    <span>
                      <b>{pickLabel(m)}</b> {marketLabel(m)}
                    </span>
                    <span>{m.trend ? `${m.trend.last10.hits}/${m.trend.last10.games}` : '—'}</span>
                    <span>
                      {m.trend?.last10.hitRate == null
                        ? 'Insufficient history'
                        : `${m.trend.last10.hitRate}%`}
                    </span>
                    <span>{m.trend?.average ?? '—'}</span>
                    <span title="Prop results against the upcoming opponent across the imported 2024–2025 seasons">
                      {m.trend?.vsOpponent.games
                        ? `${m.trend.vsOpponent.hits}/${m.trend.vsOpponent.games}`
                        : '—'}
                    </span>
                    <b>{formatOdds(m.odds)}</b>
                    <span title="Trend score is a research ranking, not a win probability">
                      {m.trend ? `${m.trend.trendScore}/100` : '—'}
                    </span>
                    <button
                      aria-label="Add to slip"
                      onClick={(event) => {
                        event.stopPropagation();
                        add(m);
                      }}
                    >
                      <Plus />
                    </button>
                  </div>
                ))}
              </div>
              {!allRows.length && <p className={styles.empty}>No markets match this filter.</p>}
              {allRows.length > TRENDING_PAGE_SIZE && (
                <nav className={styles.pagination} aria-label="Trending Props pages">
                  <span>
                    {(trendingPage - 1) * TRENDING_PAGE_SIZE + 1}–
                    {Math.min(trendingPage * TRENDING_PAGE_SIZE, allRows.length)} of{' '}
                    {allRows.length}
                  </span>
                  <div>
                    <button
                      aria-label="Previous page"
                      disabled={trendingPage === 1}
                      onClick={() => setTrendingPage((page) => Math.max(1, page - 1))}
                    >
                      <ChevronLeft />
                    </button>
                    <b>
                      Page {trendingPage} of {trendingPageCount}
                    </b>
                    <button
                      aria-label="Next page"
                      disabled={trendingPage === trendingPageCount}
                      onClick={() =>
                        setTrendingPage((page) => Math.min(trendingPageCount, page + 1))
                      }
                    >
                      <ChevronRight />
                    </button>
                  </div>
                </nav>
              )}
              <p className={styles.note}>
                Markets without at least five qualifying historical games are labeled Insufficient
                history instead of receiving an estimated trend.
              </p>
            </section>
            <div className={styles.lower}>
              <section className={styles.panel}>
                <header>
                  <h2>✨ Research Suggestions</h2>
                </header>
                <div className={styles.suggestions}>
                  {['3 leg high confidence', 'plus money', 'touchdown picks'].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setPrompt(q);
                        setSlip(
                          generateResearchSlip(markets, parseResearchPrompt(q)) as HomeMarket[],
                        );
                      }}
                    >
                      <b>{q.replace(/\b\w/g, (x) => x.toUpperCase())}</b>
                      <span>Rule-based from available markets</span>
                      <em>Add matched legs</em>
                    </button>
                  ))}
                </div>
              </section>
              <section className={styles.panel}>
                <header>
                  <h2>📊 Data Coverage</h2>
                </header>
                <ul>
                  <li>
                    Local research markets: <b>{markets.length}</b>
                  </li>
                  <li>Sportsbook handoff is optional</li>
                  <li>History awaits game-log data</li>
                </ul>
              </section>
            </div>
          </section>
          <MyParlayPanel
            legs={slip}
            markets={[...markets, ...trendingMarkets]}
            matchup={
              events.find((item) => item.id === eventId)
                ? `${events.find((item) => item.id === eventId)!.awayTeamId} @ ${events.find((item) => item.id === eventId)!.homeTeamId}`
                : 'NFL'
            }
            marketLabel={marketLabel}
            pickLabel={pickLabel}
            onRemove={(id) => setSlip((rows) => rows.filter((market) => market.id !== id))}
            onClear={() => setSlip([])}
            onSave={() => {
              localStorage.setItem('down-distance-parlay-lab-current', JSON.stringify(slip));
              const stored = JSON.parse(
                localStorage.getItem('down-distance-parlay-lab-slips') ?? '[]',
              );
              const saved = Array.isArray(stored) ? stored : [];
              saved.unshift({
                id: `slip-${Date.now()}`,
                createdAt: new Date().toISOString(),
                event: events.find((item) => item.id === eventId) ?? null,
                selections: slip,
              });
              localStorage.setItem(
                'down-distance-parlay-lab-slips',
                JSON.stringify(saved.slice(0, 20)),
              );
            }}
            onResearch={openResearch}
            buildBookLink={buildSportsbookLink}
            avatarColor={playerTeamColor}
          />
          <aside className={styles.slip} hidden>
            <header>
              <h2>
                My Parlay <span>{slip.length}</span>
              </h2>
              <button onClick={() => setSlip([])}>Clear All</button>
            </header>
            {slip.length ? (
              <>
                <div className={styles.legs}>
                  {slip.map((m, i) => (
                    <article key={`${m.id}-${m.sportsbook}`}>
                      <i>{i + 1}</i>
                      <PlayerAvatar
                        name={m.playerName}
                        headshotUrl={m.headshotUrl}
                        teamColor={playerTeamColor(m)}
                        size={30}
                      />
                      <div>
                        <b>{m.playerName ?? m.teamId}</b>
                        <span>
                          {marketLabel(m)} · {pickLabel(m)}
                        </span>
                        <small>
                          {sportsbookName(m.sportsbook)} {formatOdds(m.odds)}
                        </small>
                      </div>
                      <button onClick={() => setSlip((s) => s.filter((x) => x !== m))}>
                        <X />
                      </button>
                    </article>
                  ))}
                </div>
                <div className={styles.actions}>
                  {oneBook && sportsbookLink ? (
                    <button
                      className={styles.primary}
                      onClick={() => window.open(sportsbookLink, '_blank', 'noopener,noreferrer')}
                    >
                      Open in {sportsbookName(oneBook)} <ExternalLink />
                    </button>
                  ) : (
                    <p>No sportsbook match is currently available.</p>
                  )}
                  <button
                    className={styles.secondary}
                    onClick={() => {
                      localStorage.setItem(
                        'down-distance-parlay-lab-current',
                        JSON.stringify(slip),
                      );
                      setMessage('Saved to My Plays.');
                    }}
                  >
                    Save to My Plays
                  </button>
                  <small>
                    Use this as your research slip. Open your sportsbook and add the legs you want
                    to play. Odds and availability may change.
                  </small>
                </div>
              </>
            ) : (
              <div className={styles.blank}>
                <Plus />
                <h3>Build your parlay</h3>
                <p>Add the legs you like while you research.</p>
              </div>
            )}
            {message && (
              <div className={styles.summary}>
                <Sparkles />
                <div>
                  <b>Lab Check</b>
                  <p>{message}</p>
                </div>
              </div>
            )}
          </aside>
          {detail && (
            <div className={styles.drawerBackdrop} onClick={() => setDetail(null)}>
              <section className={styles.drawer} onClick={(event) => event.stopPropagation()}>
                <header>
                  <div>
                    <small>Trend detail</small>
                    <h2 className={styles.drawerPlayerTitle}>
                      <PlayerAvatar
                        name={detail.playerName}
                        headshotUrl={detail.headshotUrl}
                        teamColor={playerTeamColor(detail)}
                        size={42}
                      />
                      <span>
                        {detail.playerName} · {marketLabel(detail)} · {pickLabel(detail)}
                      </span>
                    </h2>
                  </div>
                  <button onClick={() => setDetail(null)}>
                    <X />
                  </button>
                </header>
                {!detailData ? (
                  <div className={styles.drawerLoading}>Cooking up the research…</div>
                ) : (
                  <ResearchDetails
                    data={detailData}
                    market={detail}
                    chartWindow={chartWindow}
                    setChartWindow={setChartWindow}
                    onAdd={add}
                    isSelected={(candidate) =>
                      slip.some(
                        (item) =>
                          item.id === candidate.id && item.sportsbook === candidate.sportsbook,
                      )
                    }
                    onAsk={() => {
                      setPrompt(
                        `What do the trends say about ${detail.playerName} ${pickLabel(detail)} ${marketLabel(detail)}?`,
                      );
                      setDetail(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  />
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </TeamThemeProvider>
  );
}

function ResearchDetails({
  data,
  market,
  chartWindow,
  setChartWindow,
  onAdd,
  isSelected,
  onAsk,
}: {
  data: ResearchDetail;
  market: HomeMarket;
  chartWindow: 'L5' | 'L10' | 'SEASON' | '2 YEARS';
  setChartWindow: (value: 'L5' | 'L10' | 'SEASON' | '2 YEARS') => void;
  onAdd: (market: HomeMarket) => void;
  isSelected: (market: HomeMarket) => boolean;
  onAsk: () => void;
}) {
  const all = data.gameByGame,
    latest = Math.max(...all.map((point) => point.season), 0),
    points =
      chartWindow === 'L5'
        ? all.slice(-5)
        : chartWindow === 'L10'
          ? all.slice(-10)
          : chartWindow === 'SEASON'
            ? all.filter((point) => point.season === latest)
            : all,
    current = data.lineLadder.rows.find((row) => row.isCurrentLine),
    ladderValues = points.map((point) => point.value).filter((value) => Number.isFinite(value)),
    sortedLadderValues = [...ladderValues].sort((a, b) => a - b),
    ladderAverage = ladderValues.length
      ? Math.round(
          (ladderValues.reduce((sum, value) => sum + value, 0) / ladderValues.length) * 10,
        ) / 10
      : null,
    ladderMedian = sortedLadderValues.length
      ? sortedLadderValues.length % 2
        ? sortedLadderValues[Math.floor(sortedLadderValues.length / 2)]
        : Math.round(
            ((sortedLadderValues[sortedLadderValues.length / 2 - 1] ?? 0) +
              (sortedLadderValues[sortedLadderValues.length / 2] ?? 0)) *
              5,
          ) / 10
      : null,
    ladderHighest = sortedLadderValues.at(-1) ?? null,
    chartWindowLabel =
      chartWindow === 'L5'
        ? 'Last 5'
        : chartWindow === 'L10'
          ? 'Last 10'
          : chartWindow === 'SEASON'
            ? 'Season'
            : '2 Years';
  const ladderSample = (row: ResearchDetail['lineLadder']['rows'][number]) =>
    chartWindow === 'L5'
      ? row.last5
      : chartWindow === 'SEASON'
        ? row.season
        : chartWindow === '2 YEARS'
          ? row.last2Years
          : row.last10;
  const activeStatName = marketDisplayName(data.market.statType);
  const venueSplits =
    chartWindow === 'L5'
      ? data.venue.windows.last5
      : chartWindow === 'L10'
        ? data.venue.windows.last10
        : chartWindow === 'SEASON'
          ? data.venue.windows.season
          : data.venue.windows.twoYear;
  const environmentLabel =
    (
      {
        THURSDAY_NIGHT: 'Thursday Night Football',
        SUNDAY_EARLY: 'Sunday Early',
        SUNDAY_LATE: 'Sunday Late',
        SUNDAY_NIGHT: 'Sunday Night Football',
        MONDAY_NIGHT: 'Monday Night Football',
        SATURDAY_DAY: 'Saturday Day',
        SATURDAY_NIGHT: 'Saturday Night',
      } as Record<string, string>
    )[data.environment.currentGame.gameWindow] ?? 'Other Game Window';
  const historicalDefenseRank = (point: ResearchDetail['gameByGame'][number]) => {
    const strength = point.opponentSeasonStrength;
    if (!strength || !data.currentOpponentStrength) return null;
    if (data.currentOpponentStrength.defenseContext === 'PASS') return strength.passDefenseRank;
    if (data.currentOpponentStrength.defenseContext === 'RUSH') return strength.rushDefenseRank;
    if (data.currentOpponentStrength.defenseContext === 'SCORING')
      return strength.scoringDefenseRank;
    return strength.totalDefenseRank;
  };
  return (
    <>
      <div className={styles.drawerPrices}>
        <span>FanDuel {formatOdds(current?.fanduelPrice ?? null)}</span>
        <span>DraftKings {formatOdds(current?.draftkingsPrice ?? null)}</span>
        <button onClick={() => onAdd(market)}>+ Add to parlay</button>
      </div>
      <div className={styles.metrics}>
        <article>
          <span>Last 5</span>
          <b>
            {data.summary.last5.hits}/{data.summary.last5.games}
          </b>
        </article>
        <article>
          <span>Last 10</span>
          <b>
            {data.summary.last10.hits}/{data.summary.last10.games}
          </b>
        </article>
        <article>
          <span>Vs. {data.upcomingMatchup?.opponentAbbreviation ?? 'Opponent'}</span>
          <b>
            {data.summary.vsOpponent.hits}/{data.summary.vsOpponent.games}
          </b>
        </article>
        <article>
          <span>Average</span>
          <b>{data.summary.average ?? '—'}</b>
        </article>
        <article>
          <span>Median</span>
          <b>{data.summary.median ?? '—'}</b>
        </article>
        <article>
          <span>Streak</span>
          <b>
            {data.summary.streakType} {data.summary.streakLength}
          </b>
        </article>
        <article>
          <span>Confidence</span>
          <b>{data.summary.sampleConfidence}</b>
        </article>
        <article>
          <span>Trend score</span>
          <b>{data.summary.trendScore}/100</b>
        </article>
      </div>
      {data.upcomingMatchup && (
        <aside className={styles.upcomingMatchup}>
          <div>
            <small>Next matchup</small>
            <strong>vs {data.upcomingMatchup.opponentAbbreviation}</strong>
            <span>{data.upcomingMatchup.opponentName}</span>
          </div>
          <div>
            <small>
              {data.upcomingMatchup.defenseSeason} final · {data.upcomingMatchup.defenseLabel}
            </small>
            <strong>#{data.upcomingMatchup.defenseRank} NFL</strong>
            <span>{data.upcomingMatchup.matchupLabel}</span>
          </div>
          <div>
            <small>{data.upcomingMatchup.relevantMetricName}</small>
            <strong>{data.upcomingMatchup.relevantMetricValue.toFixed(1)}</strong>
            <span>
              {data.summary.vsOpponent.games
                ? `${data.summary.vsOpponent.hits}/${data.summary.vsOpponent.games} at this line vs ${data.upcomingMatchup.opponentAbbreviation}`
                : `No qualifying history vs ${data.upcomingMatchup.opponentAbbreviation}`}
            </span>
          </div>
        </aside>
      )}
      <section className={styles.researchSection}>
        <header>
          <div>
            <small>Last 10</small>
            <h3>Game by game</h3>
          </div>
          <nav>
            {(['L5', 'L10', 'SEASON', '2 YEARS'] as const).map((value) => (
              <button
                className={chartWindow === value ? styles.selectedControl : ''}
                key={value}
                onClick={() => setChartWindow(value)}
              >
                {value}
              </button>
            ))}
          </nav>
        </header>
        <GameByGameTrendChart
          marketLabel={marketLabel(market)}
          upcomingMatchup={data.upcomingMatchup}
          points={points.map((point) => ({
            ...point,
            opponentDefenseRank: historicalDefenseRank(point),
            defenseLabel: data.currentOpponentStrength?.defenseLabel,
          }))}
        />
        <details>
          <summary>View game log</summary>
          <div className={styles.gameLog}>
            {points.map((game) => (
              <div key={game.gameId}>
                <time>{game.date}</time>
                <span>
                  {game.homeAway === 'HOME' ? 'vs' : '@'} {game.opponent}
                </span>
                <b>{game.value}</b>
                <em className={game.result === 'HIT' ? styles.hit : styles.miss}>
                  {game.result} {game.margin >= 0 ? '+' : ''}
                  {game.margin}
                </em>
                <span title={`${game.opponent} final ${game.season} regular-season ranking`}>
                  {historicalDefenseRank(game) ? `#${historicalDefenseRank(game)} DEF` : '—'}
                </span>
              </div>
            ))}
          </div>
        </details>
      </section>
      {data.currentOpponentStrength && (
        <section className={styles.researchSection}>
          <header>
            <div>
              <small>{data.currentOpponentStrength.season} FINAL REGULAR SEASON</small>
              <h3>Current matchup strength</h3>
            </div>
          </header>
          <div className={styles.metrics}>
            <article>
              <span>Lab Match</span>
              <b>{data.labMatchScore}/100</b>
            </article>
            <article>
              <span>{data.currentOpponentStrength.defenseLabel}</span>
              <b>#{data.currentOpponentStrength.rank}</b>
            </article>
            <article>
              <span>Miss context</span>
              <b>{data.missContext.missContextScore ?? '—'}/100</b>
            </article>
          </div>
          {data.generatedInsight && (
            <p className={styles.labNote}>
              <b>Lab Match</b> {data.generatedInsight}
            </p>
          )}
        </section>
      )}
      <section className={styles.researchSection}>
        <header>
          <div>
            <small>Game environment</small>
            <h3>
              {data.environment.currentGame.dayNight === 'NIGHT' ? '🌙' : '☀️'} {environmentLabel}
            </h3>
            <p>
              Current game ·{' '}
              {data.environment.currentGame.dayNight === 'NIGHT' ? 'Night game' : 'Day game'}
              {data.environment.currentGame.restDays !== null
                ? ` · ${data.environment.currentGame.restDays} days rest`
                : ' · Season opener'}
            </p>
          </div>
        </header>
        <div className={styles.environmentGrid}>
          {data.environment.relevantSplits.map((split) => (
            <article key={split.key}>
              <span>{split.label}</span>
              <b>
                {split.value.hits}/{split.value.games}
              </b>
              <strong>{split.value.hitRate === null ? '—' : `${split.value.hitRate}%`}</strong>
              <small>{split.value.sampleConfidence}</small>
            </article>
          ))}
        </div>
        {data.environment.insights[0] && (
          <p className={styles.labNote}>
            <b>{data.environment.insights[0].label}</b> {data.environment.insights[0].text}
          </p>
        )}
        <details className={styles.environmentDetails}>
          <summary>View all game splits</summary>
          <div className={styles.environmentAllSplits}>
            {Object.entries({
              'Day games': data.environment.splits.day,
              'Night games': data.environment.splits.night,
              Primetime: data.environment.splits.primetime,
              TNF: data.environment.splits.thursdayNight,
              SNF: data.environment.splits.sundayNight,
              MNF: data.environment.splits.mondayNight,
              'Sunday early': data.environment.splits.sundayEarly,
              'Sunday late': data.environment.splits.sundayLate,
              'Short rest': data.environment.splits.shortRest,
              'Normal rest': data.environment.splits.normalRest,
              'Extended rest': data.environment.splits.extendedRest,
            }).map(([label, split]) => (
              <span key={label}>
                <b>{label}</b> {split.hits}/{split.games} · {split.hitRate ?? '—'}%
              </span>
            ))}
          </div>
        </details>
      </section>
      <section className={styles.researchSection}>
        <header>
          <div>
            <small>Venue check</small>
            <h3>
              🏟️{' '}
              {data.venue.current.environment === 'UNKNOWN'
                ? data.venue.current.roofType === 'RETRACTABLE'
                  ? 'Retractable roof'
                  : 'Venue status unknown'
                : `${data.venue.current.environment === 'INDOOR' ? 'Indoors' : 'Outdoors'}`}
            </h3>
            <p>
              {data.venue.current.stadium ?? 'Venue unavailable'}
              {!data.venue.current.statusKnown && ' · Roof status unknown'}
            </p>
          </div>
          <nav>
            {(['L5', 'L10', 'SEASON', '2 YEARS'] as const).map((value) => (
              <button
                className={chartWindow === value ? styles.selectedControl : ''}
                key={value}
                onClick={() => setChartWindow(value)}
              >
                {value === 'L5'
                  ? 'Last 5'
                  : value === 'L10'
                    ? 'Last 10'
                    : value === 'SEASON'
                      ? 'Season'
                      : '2 Years'}
              </button>
            ))}
          </nav>
        </header>
        <div className={styles.venueGrid}>
          {(
            [
              ['INDOOR', 'Indoors', venueSplits.indoor],
              ['OUTDOOR', 'Outdoors', venueSplits.outdoor],
            ] as const
          ).map(([environment, label, split]) => (
            <article
              className={data.venue.current.environment === environment ? styles.currentVenue : ''}
              key={environment}
            >
              <span>{label}</span>
              <b>
                {split.hits}/{split.games}
              </b>
              <strong>{split.hitRate === null ? '—' : `${split.hitRate}%`}</strong>
              <small>{split.sampleConfidence}</small>
              <em>
                Avg {split.average ?? '—'} · Margin{' '}
                {split.averageMargin === null
                  ? '—'
                  : `${split.averageMargin > 0 ? '+' : ''}${split.averageMargin}`}
              </em>
            </article>
          ))}
        </div>
        {venueSplits.unknown.games > 0 && (
          <p className={styles.unknownVenue}>
            {venueSplits.unknown.games} game{venueSplits.unknown.games === 1 ? '' : 's'} excluded
            because venue status is unknown.
          </p>
        )}
        {chartWindow === '2 YEARS' && data.venue.relevantInsight && (
          <p className={styles.labNote}>
            <b>{data.venue.current.environment === 'INDOOR' ? 'Indoor check' : 'Outdoor check'}</b>{' '}
            {data.venue.relevantInsight}
          </p>
        )}
      </section>
      <section className={styles.researchSection}>
        <header>
          <div>
            <small>How far can we push it?</small>
            <h3>Line ladder</h3>
            <p>
              See how often {market.playerName} has reached each{' '}
              {ladderDescriptionUnit(data.market.statType)} over this historical window — and what
              you get at each line.
            </p>
          </div>
          <nav>
            {(['L5', 'L10', 'SEASON', '2 YEARS'] as const).map((value) => (
              <button
                className={chartWindow === value ? styles.selectedControl : ''}
                key={value}
                onClick={() => setChartWindow(value)}
              >
                {value === 'L5'
                  ? 'Last 5'
                  : value === 'L10'
                    ? 'Last 10'
                    : value === 'SEASON'
                      ? 'Season'
                      : '2 Years'}
              </button>
            ))}
          </nav>
        </header>
        <div className={styles.ladderContext}>
          <div className={styles.ladderPlayer}>
            <PlayerAvatar
              name={market.playerName}
              headshotUrl={market.headshotUrl}
              teamColor={playerTeamColor(market)}
              size={42}
            />
            <div>
              <strong>{market.playerName ?? 'Player'}</strong>
              <span>{activeStatName}</span>
              <small>
                {chartWindowLabel} average: {ladderAverage ?? '—'} · Median: {ladderMedian ?? '—'} ·
                Highest: {ladderHighest ?? '—'}
              </small>
            </div>
          </div>
          {chartWindow === 'L10' && data.lineLadderInsight && (
            <p>
              <b>💡 Lab insight</b> {data.lineLadderInsight}
            </p>
          )}
        </div>
        <LineLadderChart rows={data.lineLadder.rows} window={chartWindow} />
        <div className={styles.ladder}>
          <div>
            <b>Line ({activeStatName})</b>
            <b>{chartWindowLabel}</b>
            <b>Hit rate</b>
            <b>Historical rate</b>
            <b>FD</b>
            <b>DK</b>
            <b>Action</b>
          </div>
          {data.lineLadder.rows.map((row) => (
            <div className={row.isCurrentLine ? styles.currentLine : ''} key={row.threshold}>
              <strong>
                {row.displayThreshold}
                <small>
                  {row.isCurrentLine
                    ? row.markets.some(isSelected)
                      ? 'Your pick'
                      : "Today's line"
                    : (
                          market.side === 'UNDER'
                            ? row.threshold > (market.line ?? 0)
                            : row.threshold < (market.line ?? 0)
                        )
                      ? 'Safer'
                      : 'Push it'}
                </small>
              </strong>
              <span>
                {ladderSample(row).hits}/{ladderSample(row).games}
              </span>
              <span>
                {ladderSample(row).hitRate ?? '—'}
                {ladderSample(row).hitRate !== null ? '%' : ''}
              </span>
              <span className={styles.hitRateTrack}>
                <i style={{ width: `${ladderSample(row).hitRate ?? 0}%` }} />
              </span>
              <span>{formatOdds(row.fanduelPrice)}</span>
              <span>{formatOdds(row.draftkingsPrice)}</span>
              {row.isAvailable && row.markets[0] ? (
                <button
                  aria-label={`Add ${market.playerName} ${row.displayThreshold} to parlay`}
                  className={row.markets.some(isSelected) ? styles.addedLadder : ''}
                  onClick={() => onAdd(row.markets[0]!)}
                >
                  {row.markets.some(isSelected) ? 'Added' : '+'}
                </button>
              ) : (
                <small>Research only</small>
              )}
            </div>
          ))}
        </div>
        {chartWindow === 'L10' && data.lineLadder.ladderSweetSpot && (
          <p className={styles.labNote}>
            <b>Lab note</b> {data.lineLadder.ladderSweetSpot}
          </p>
        )}
      </section>
      <section className={styles.researchSection}>
        <header>
          <div>
            <small>Matchup check</small>
            <h3>
              How {data.opponentVsPosition?.label ?? 'players'} have done vs{' '}
              {data.market.opponentId ?? 'the opponent'}
            </h3>
          </div>
        </header>
        {data.opponentVsPosition ? (
          <>
            <div className={styles.metrics}>
              <article>
                <span>Last 5</span>
                <b>
                  {data.opponentVsPosition.last5.hits}/{data.opponentVsPosition.last5.games}
                </b>
              </article>
              <article>
                <span>Last 10</span>
                <b>
                  {data.opponentVsPosition.last10.hits}/{data.opponentVsPosition.last10.games}
                </b>
              </article>
              <article>
                <span>Average</span>
                <b>{data.opponentVsPosition.last10.average ?? '—'}</b>
              </article>
              <article>
                <span>Confidence</span>
                <b>{data.opponentVsPosition.sampleConfidence}</b>
              </article>
            </div>
            <OpponentVsPositionChart
              points={data.opponentVsPosition.recentResults}
              line={market.line ?? 0}
              label={`${data.opponentVsPosition.label} vs ${data.market.opponentId ?? 'opponent'}`}
            />
            <p>
              {data.opponentVsPosition.qualification}. Sample counts are qualifying performances.
            </p>
          </>
        ) : (
          <p>Limited opponent sample.</p>
        )}
      </section>
      {data.usage.last5 !== null && (
        <section className={styles.researchSection}>
          <header>
            <div>
              <small>Usage check</small>
              <h3>{data.usage.primaryMetric}</h3>
            </div>
          </header>
          <div className={styles.contextMetrics}>
            <article>
              <span>Last 5</span>
              <b>{data.usage.last5}</b>
            </article>
            <article>
              <span>Previous 5</span>
              <b>{data.usage.previous5 ?? '—'}</b>
            </article>
            <article>
              <span>Change</span>
              <b>
                {data.usage.trendPct === null
                  ? '—'
                  : `${data.usage.trendPct > 0 ? '+' : ''}${data.usage.trendPct}%`}
              </b>
              <small>{data.usage.trendLabel ?? 'Limited history'}</small>
            </article>
          </div>
          <div
            className={styles.usageBars}
            aria-label={`Last ten ${data.usage.primaryMetric.toLowerCase()}`}
          >
            {data.usage.series.map((point) => (
              <i
                key={`${point.date}-${point.value}`}
                title={`${point.date}: ${point.value}`}
                style={{
                  height: `${Math.max(8, (point.value / Math.max(...data.usage.series.map((item) => item.value), 1)) * 100)}%`,
                }}
              />
            ))}
          </div>
          {data.usage.trendPct !== null && (
            <p className={styles.labNote}>
              <b>{data.usage.trendLabel}</b> {market.playerName} is averaging {data.usage.last5}{' '}
              {data.usage.primaryMetric.toLowerCase()} over the last five,{' '}
              {data.usage.trendPct >= 0 ? 'up' : 'down'} {Math.abs(data.usage.trendPct)}% from the
              previous five.
            </p>
          )}
        </section>
      )}
      {data.lineMargin.games > 0 && (
        <section className={styles.researchSection}>
          <header>
            <div>
              <small>Line cushion</small>
              <h3>{data.lineMargin.label ?? 'Recent margin'}</h3>
            </div>
          </header>
          <div className={styles.contextMetrics}>
            <article>
              <span>Today&apos;s line</span>
              <b>{market.line}</b>
            </article>
            <article>
              <span>Last 10 avg</span>
              <b>{data.lineMargin.average ?? '—'}</b>
            </article>
            <article>
              <span>Average margin</span>
              <b>
                {data.lineMargin.averageMargin === null
                  ? '—'
                  : `${data.lineMargin.averageMargin > 0 ? '+' : ''}${data.lineMargin.averageMargin}`}
              </b>
            </article>
            <article>
              <span>Median margin</span>
              <b>
                {data.lineMargin.medianMargin === null
                  ? '—'
                  : `${data.lineMargin.medianMargin > 0 ? '+' : ''}${data.lineMargin.medianMargin}`}
              </b>
            </article>
          </div>
          <div className={styles.cushionBuckets}>
            {data.lineMargin.clearByBuckets.map((bucket) => (
              <span key={bucket.amount}>
                Cleared by {bucket.amount}+{' '}
                <b>
                  {bucket.hits}/{bucket.games}
                </b>
              </span>
            ))}
          </div>
        </section>
      )}
      {data.consistency && (
        <details className={styles.chartAccordion}>
          <summary>Consistency · {data.consistency.label}</summary>
          <div className={styles.consistencyContent}>
            <strong>{data.consistency.score}/100</strong>
            <p>
              {data.consistency.withinMiddle50} of {data.consistency.games} recent games landed in
              the middle range of {data.consistency.middle50Range[0]}–
              {data.consistency.middle50Range[1]} {activeStatName.toLowerCase()}.
            </p>
            <small>
              {data.consistency.outlierCount} statistical outlier
              {data.consistency.outlierCount === 1 ? '' : 's'} in this sample.
            </small>
          </div>
        </details>
      )}
      {data.gameScript && (
        <section className={styles.researchSection}>
          <header>
            <div>
              <small>Game script</small>
              <h3>
                {market.teamId} {data.gameScript.spread > 0 ? '+' : ''}
                {data.gameScript.spread}
              </h3>
            </div>
          </header>
          <div className={styles.scriptSummary}>
            <b>{data.gameScript.scriptBucket.replaceAll('_', ' ')}</b>
            {data.gameScript.total !== null && <span>O/U {data.gameScript.total}</span>}
          </div>
          <p className={styles.labNote}>
            <b>Lab take</b> {data.gameScript.relevantInsight}
          </p>
        </section>
      )}
      <details className={styles.chartAccordion}>
        <summary>Where does he usually land?</summary>
        <div>
          <ResultDistributionChart bins={data.distribution.bins} line={market.line ?? 0} />
          <p>{data.distribution.sampleSize} historical games in this sample.</p>
        </div>
      </details>
      <button className={styles.askContext} onClick={onAsk}>
        Ask the Lab about this
      </button>
      <p>Trend score is a research ranking, not a probability or prediction.</p>
    </>
  );
}
