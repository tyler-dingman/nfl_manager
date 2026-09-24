'use client';
import {
  Sparkles,
  BarChart3,
  Flame,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  X,
} from 'lucide-react';

import type { calculateResearchScore, Alignment } from '@/server/historical-stats/research-score';

import Link from 'next/link';
import Image from 'next/image';
import { Crosshair, FlaskConical } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

import { useEffect, useMemo, useState, useRef } from 'react';
import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import { useTeamStore } from '@/features/team/team-store';
import {
  readCanonicalFanTeamPreference,
  readFanTeamPreference,
} from '@/features/team/fan-team-preference';
import { TEAM_LIST } from '@/data/teams';
import { sportsbookName } from '@/server/odds/sportsbooks';
import RideTheBusDrawer from './RideTheBusDrawer';
import { ladderDescriptionUnit, marketDisplayName } from '@/lib/parlay-lab/market-display';
import { buildSportsbookLink, type Market } from './ParlayLabPage';
import PlayerAvatar from './PlayerAvatar';
import { isLabPickMarket, matchesTrendingMarketFilter } from './trending-market-filter';
import MyParlayPanel from './MyParlayPanel';
import ParlayLabSecondaryNav from './ParlayLabSecondaryNav';
import ParlaySortHeader from './ParlaySortHeader';
import { snapshotSavedPlay } from './saved-plays';
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
import ResearchWorkspace from './ResearchWorkspace';
import { LabScore, LabScoreGuide, LineBadge, TrendHelp } from './TrendEducation';
import { representativeTrends, trendReason, compactTrendReason } from './trending-context';

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
  researchScore?: ReturnType<typeof calculateResearchScore>;
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
export type HomeMarket = Market & {
  trend?: Trend | null;
  eventId?: string;
  position?: string | null;
  lineType?: 'main' | 'alternate' | 'unknown';
  mainLine?: number | null;
  matchup?: {
    opponentId: string | null;
    alignment?: Alignment;
    explanation?: string;
    rank: number | null;
    label: string;
    season: number | null;
  };
};
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
export type ResearchDetail = {
  player?: { name: string; position?: string; teamId?: string };
  event?: OddsEvent;
  currentPrices?: HomeMarket[];
  seasonStats?: { season: number; items: Array<{ label: string; value: string }> };
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
  season?: number;
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
  const teams = useTeamStore((s) => s.teams);
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);
  const [fanTeam, setFanTeam] = useState<string | null>(null);
  const creatorTeam =
    teams.find((t) => t.abbr === (searchParams?.get('team')?.toUpperCase() ?? fanTeam)) ??
    teams.find((t) => t.id === selectedTeamId);
  useEffect(() => {
    setFanTeam(readFanTeamPreference());
    void readCanonicalFanTeamPreference().then(setFanTeam);
  }, []);
  const [marketState, setMarketState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [marketError, setMarketError] = useState('');
  const [marketRetry, setMarketRetry] = useState(0);
  const [events, setEvents] = useState<OddsEvent[]>([]),
    [eventId, setEventId] = useState(''),
    [markets, setMarkets] = useState<HomeMarket[]>([]),
    [trendingGameId, setTrendingGameId] = useState('ALL'),
    [trendingMarkets, setTrendingMarkets] = useState<HomeMarket[]>([]),
    [slip, setSlip] = useState<HomeMarket[]>([]),
    [rideOpen, setRideOpen] = useState(false),
    [filter, setFilter] = useState('ALL'),
    [lineFilter, setLineFilter] = useState('ALL'),
    [showAllThresholds, setShowAllThresholds] = useState(false),
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
    setMarketState('loading');
    setTrendingMarkets([]);
    setMarketError('');
    fetch('/api/parlay-lab/events')
      .then((r) => {
        if (!r.ok) throw new Error('Events unavailable');
        return r.json();
      })
      .then((b) => {
        const rows = (b.events ?? []) as OddsEvent[];
        setEvents(rows);
        if (!rows.length) setMarketState('ready');
        setEventId(rows[0]?.id ?? '');
      })
      .catch(() => {
        setMessage('Local odds are unavailable.');
        setMarketError('Markets could not be loaded. Please try again.');
        setMarketState('error');
      });
  }, [marketRetry]);
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
    setMarketState('loading');
    setMarketError('');
    fetch(`/api/parlay-lab/research?eventId=${encodeURIComponent(trendingGameId)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Markets unavailable');
        return response.json();
      })
      .then((body) => {
        if (!controller.signal.aborted) {
          setTrendingMarkets((body.markets ?? []).filter((market: HomeMarket) => market.available));
          setMarketState('ready');
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setMessage('Trending markets could not be loaded.');
          setMarketError('Markets could not be loaded. Please try again.');
          setMarketState('error');
        }
      });
    return () => controller.abort();
  }, [events, trendingGameId]);
  useEffect(
    () => setTrendingPage(1),
    [
      filter,
      lineFilter,
      showAllThresholds,
      oddsFilter,
      oddsMinimum,
      oddsMaximum,
      trendingGameId,
      trendingSort,
    ],
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const allRows = useMemo(() => {
    const unique = new Map<string, HomeMarket>();
    for (const m of trendingMarkets) {
      if (lineFilter !== 'ALL' && m.lineType !== lineFilter) continue;
      const key = `${m.eventId ?? trendingGameId}:${m.normalizedKey}`;
      const old = unique.get(key);
      if (!old || (m.odds ?? -9999) > (old.odds ?? -9999)) unique.set(key, m);
    }
    const eligible = [...unique.values()]
      .filter((m) =>
        filter === 'LAB_FINDS' ? isLabPickMarket(m) : matchesTrendingMarketFilter(m, filter),
      )
      .filter((market) => lineFilter === 'ALL' || market.lineType === lineFilter)
      .filter((market) => matchesOddsFilter(market.odds, oddsFilter, oddsMinimum, oddsMaximum))
      .sort((a, b) => (b.trend?.trendScore ?? -1) - (a.trend?.trendScore ?? -1));
    const filtered = (showAllThresholds ? eligible : representativeTrends(eligible)).sort(
      (a, b) => (b.trend?.trendScore ?? -1) - (a.trend?.trendScore ?? -1),
    );
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
        average: (market) => market.trend?.recentAverage10,
        opponent: (market) => market.matchup?.rank,
        odds: (market) => (market.odds == null ? null : americanOddsToDecimal(market.odds)),
        score: (market) => market.trend?.trendScore,
      });
    return filtered;
  }, [
    trendingMarkets,
    filter,
    lineFilter,
    showAllThresholds,
    trendingGameId,
    oddsFilter,
    oddsMinimum,
    oddsMaximum,
    trendingSort,
  ]);
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
  const researchRequest = useRef<AbortController | null>(null);
  const [researchError, setResearchError] = useState('');
  useEffect(() => () => researchRequest.current?.abort(), []);
  const openResearch = (market: HomeMarket) => {
    researchRequest.current?.abort();
    const controller = new AbortController();
    researchRequest.current = controller;
    setResearchError('');
    setDetail(market);
    setDetailData(null);
    setChartWindow('L10');
    const query = new URLSearchParams({
      eventId: market.eventId ?? eventId,
      sportsbook: market.sportsbook,
      period: market.period,
      playerId: market.playerId ?? '',
      marketType: market.marketType,
      line: String(market.line),
      side: market.side,
    });
    fetch(`/api/parlay-lab/research?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Research unavailable');
        return response.json();
      })
      .then((body) => {
        if (!controller.signal.aborted) setDetailData(body);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResearchError('Research could not be loaded. Please close and try again.');
      });
  };
  const oneBook =
    slip.length > 0 && slip.every((x) => x.sportsbook === slip[0]?.sportsbook)
      ? slip[0].sportsbook
      : null;
  const sportsbookLink = oneBook ? buildSportsbookLink(slip, oneBook) : null;
  return (
    <TeamThemeProvider>
      <div className={styles.shell}>
        <MainSiteHeader active="parlay-lab" tone="merch" />
        <ParlayLabSecondaryNav />
        <header className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroBrand}>
              <div className={styles.heroAtom} aria-hidden="true">
                <Image src="/assets/science_icon.png" alt="" width={1337} height={1176} priority />
              </div>
              <div className={styles.heroCopy}>
                <p>Advanced Analytics</p>
                <h1>
                  Parlay <span>Lab</span>
                </h1>
                <h2>Research. Analyze. Build smarter parlays.</h2>
              </div>
            </div>
            <div className={styles.values}>
              <article>
                <BarChart3 />
                <b>Real Data</b>
                <span>League stats &amp; trends</span>
              </article>
              <article>
                <Crosshair />
                <b>Better Insights</b>
                <span>Find value, faster</span>
              </article>
              <article>
                <FlaskConical />
                <b>Smarter Bets</b>
                <span>Make informed picks</span>
              </article>
            </div>
          </div>
        </header>
        <RideTheBusDrawer
          team={creatorTeam}
          marketState={marketState}
          marketError={marketError}
          onRetry={() => setMarketRetry((value) => value + 1)}
          open={rideOpen}
          onClose={() => setRideOpen(false)}
          markets={trendingMarkets}
          slip={slip}
          onAdd={(legs) =>
            setSlip((previous) => {
              const next = [...previous];
              for (const leg of legs)
                if (
                  leg.available &&
                  !next.some((m) => m.id === leg.id && m.sportsbook === leg.sportsbook)
                )
                  next.push(leg);
              return next;
            })
          }
          onResearch={(leg) => {
            setRideOpen(false);
            setTimeout(() => openResearch(leg), 0);
          }}
        />
        <main className={styles.page}>
          <section className={styles.main}>
            <section className={styles.panel} id="trending-props">
              <header className={styles.trendingHeader}>
                <div>
                  <h2>
                    <Flame aria-hidden="true" />
                    Trending Props
                  </h2>
                  <p>
                    Props with the strongest statistical trends right now, ranked using recent hit
                    rate, consistency, line cushion, matchup and supporting context.
                  </p>
                </div>
                <div className={styles.trendActions}>
                  <button
                    className={styles.rideButton}
                    onClick={(event) => {
                      event.currentTarget.focus();
                      setRideOpen(true);
                    }}
                  >
                    <Sparkles aria-hidden="true" /> Create a Parlay
                  </button>
                  <Link href="/parlay-lab/trends">See all trends →</Link>
                </div>
              </header>
              <button
                className={styles.mobileFilterToggle}
                aria-expanded={mobileFiltersOpen}
                aria-controls="trending-filters"
                onClick={() => setMobileFiltersOpen((open) => !open)}
              >
                {mobileFiltersOpen ? 'Hide filters' : 'Filter'}
                {[
                  filter !== 'ALL',
                  trendingGameId !== 'ALL',
                  lineFilter !== 'ALL',
                  oddsFilter !== 'ALL',
                  showAllThresholds,
                ].filter(Boolean).length > 0 && ' • Active'}
              </button>
              <div
                id="trending-filters"
                className={styles.trendingControls}
                data-mobile-open={mobileFiltersOpen}
              >
                <label className={styles.gameFilter}>
                  <select
                    aria-label="Prop category"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  >
                    <option value="ALL">All Props</option>
                    <option value="PASSING">Passing Props</option>
                    <option value="RUSHING">Rushing Props</option>
                    <option value="RECEIVING">Receiving Props</option>
                    <option value="TOUCHDOWN">Touchdown Props</option>
                    <option value="LAB_FINDS">Lab Finds</option>
                  </select>
                </label>
                <label className={styles.gameFilter}>
                  <select
                    aria-label="Match-up"
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
                  <select
                    aria-label="Line type"
                    value={lineFilter}
                    onChange={(event) => setLineFilter(event.target.value)}
                  >
                    <option value="ALL">All Lines</option>
                    <option value="main">Main Lines</option>
                    <option value="alternate">Alt Lines</option>
                  </select>
                </label>
                <label className={styles.gameFilter}>
                  <select
                    aria-label="Odds"
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
                <label className={styles.allThresholds}>
                  <input
                    type="checkbox"
                    checked={showAllThresholds}
                    onChange={(event) => setShowAllThresholds(event.target.checked)}
                  />{' '}
                  Show all thresholds
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
                    label="L10"
                    sortKey="last10"
                    sort={trendingSort}
                    onSort={(key) => setTrendingSort((sort) => nextSort(sort, key))}
                  />
                  <ParlaySortHeader
                    label="AVG"
                    sortKey="average"
                    sort={trendingSort}
                    onSort={(key) => setTrendingSort((sort) => nextSort(sort, key))}
                  />
                  <ParlaySortHeader
                    label="Matchup"
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
                  <div className={styles.scoreHeading}>
                    <ParlaySortHeader
                      label="Lab Score"
                      sortKey="score"
                      sort={trendingSort}
                      onSort={(key) => setTrendingSort((sort) => nextSort(sort, key))}
                      title="Research/trend strength, not hit probability or betting value."
                    />
                    <TrendHelp compact />
                  </div>
                  <span>Why it’s trending</span>
                  <span>Add</span>
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
                      <span>
                        <button
                          className={styles.researchPlayerButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            openResearch(m);
                          }}
                        >
                          {m.playerName ?? m.teamId ?? 'Game'}
                        </button>
                        <small>{[m.teamId, m.position].filter(Boolean).join(' • ')}</small>
                      </span>
                    </strong>
                    <div className={styles.marketCell}>
                      <b>{pickLabel(m)}</b>
                      <span title={marketLabel(m)}>{marketLabel(m)}</span>
                      {m.lineType !== 'main' && (
                        <LineBadge lineType={m.lineType} mainLine={m.mainLine} />
                      )}
                    </div>
                    <span
                      title={
                        m.trend?.last10.hitRate == null
                          ? 'Insufficient history'
                          : `${m.trend.last10.hitRate}% historical hit rate, not a prediction`
                      }
                      data-label="L10"
                      className={
                        m.trend && (m.trend.last10.hitRate ?? 0) >= 80
                          ? styles.strongTrend
                          : undefined
                      }
                    >
                      {m.trend ? `${m.trend.last10.hits}/${m.trend.last10.games}` : '—'}
                    </span>
                    <span data-label="Average" title="Last 10 qualifying games">
                      {m.trend?.recentAverage10 == null
                        ? '—'
                        : Number(m.trend.recentAverage10.toFixed(1))}
                    </span>
                    <div className={styles.matchupCell} data-label="Matchup">
                      <b>{m.matchup?.opponentId ? `vs ${m.matchup.opponentId}` : '—'}</b>
                      <small
                        title={
                          m.matchup?.season
                            ? `${m.matchup.season} regular-season yardage ranking. ${m.matchup.explanation ?? ''}`
                            : undefined
                        }
                      >
                        {m.matchup?.rank ? `${m.matchup.label} #${m.matchup.rank}` : '—'}
                        {m.matchup?.alignment === 'conflicts' && (
                          <span aria-label={m.matchup.explanation} title={m.matchup.explanation}>
                            {' '}
                            ⚠
                          </span>
                        )}
                      </small>
                    </div>
                    <b data-label="Odds" title={sportsbookName(m.sportsbook)}>
                      {formatOdds(m.odds)}
                    </b>
                    <div data-label="Lab Score">
                      <LabScore inline score={m.trend?.trendScore} />
                    </div>
                    <div
                      className={styles.trendReason}
                      data-label="Why it’s trending"
                      title={`${trendReason(m).title} · ${trendReason(m).detail}`}
                    >
                      {trendReason(m).streak ? (
                        <Flame aria-hidden="true" />
                      ) : (
                        <BarChart3 aria-hidden="true" />
                      )}
                      <span>{compactTrendReason(m)}</span>
                    </div>
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
                  <h2>
                    <BarChart3 aria-hidden="true" />
                    Data Coverage
                  </h2>
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
          <div className={styles.rightRail}>
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
                saved.unshift(
                  snapshotSavedPlay({
                    event: events.find((item) => item.id === eventId) ?? null,
                    selections: slip,
                  }),
                );
                localStorage.setItem(
                  'down-distance-parlay-lab-slips',
                  JSON.stringify(saved.slice(0, 20)),
                );
              }}
              onResearch={openResearch}
              buildBookLink={buildSportsbookLink}
              avatarColor={playerTeamColor}
            />
            <LabScoreGuide />
          </div>
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
            <ResearchWorkspace
              key={`${detail.id}:${detail.sportsbook}`}
              market={detail}
              data={detailData}
              error={researchError}
              onClose={() => {
                researchRequest.current?.abort();
                setDetail(null);
              }}
              onAdd={() => add(detail)}
              added={slip.some(
                (item) => item.id === detail.id && item.sportsbook === detail.sportsbook,
              )}
              chartWindow={chartWindow}
              setChartWindow={setChartWindow}
              renderDetails={(tab) =>
                detailData ? (
                  <ResearchDetails
                    data={detailData}
                    market={detail}
                    tab={tab}
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
                      setDetail(null);
                      setRideOpen(true);
                    }}
                  />
                ) : null
              }
            />
          )}
        </main>
      </div>
    </TeamThemeProvider>
  );
}

function ResearchDetails({
  tab,
  data,
  market,
  chartWindow,
  setChartWindow,
  onAdd,
  isSelected,
  onAsk,
}: {
  tab: string;
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
            : all.filter((point) => point.season >= latest - 1),
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
      {tab === 'Game Log' && (
        <>
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
            <details open>
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
        </>
      )}
      {tab === 'Matchup' && (
        <>
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
                  <span>Lab Score</span>
                  <b>{data.labMatchScore}/100</b>
                </article>
                <article>
                  <span>{data.currentOpponentStrength.defenseLabel}</span>
                  <b>#{data.currentOpponentStrength.rank}</b>
                </article>
                <article>
                  <span>Selected-side matchup</span>
                  <b>{data.summary.researchScore?.matchup.label ?? 'Unknown'}</b>
                </article>
              </div>
              {data.generatedInsight && (
                <p className={styles.labNote}>
                  <b>Lab Match</b> {data.generatedInsight}
                </p>
              )}
            </section>
          )}
        </>
      )}
      {tab === 'Splits' && (
        <>
          <section className={styles.researchSection}>
            <header>
              <h3>Home, away &amp; opponent splits</h3>
            </header>
            <div className={styles.metrics}>
              {(
                [
                  ['Home', data.summary.home],
                  ['Away', data.summary.away],
                  ['Vs opponent', data.summary.vsOpponent],
                ] as const
              ).map(([label, sample]) => (
                <article key={label}>
                  <span>{label}</span>
                  <b>{sample.games ? `${sample.hits}/${sample.games}` : '—'}</b>
                  <small>
                    {sample.hitRate == null
                      ? 'Insufficient history'
                      : `${sample.hitRate}% hit rate`}
                  </small>
                </article>
              ))}
            </div>
          </section>
          <section className={styles.researchSection}>
            <header>
              <div>
                <small>Game environment</small>
                <h3>
                  {data.environment.currentGame.dayNight === 'NIGHT' ? '🌙' : '☀️'}{' '}
                  {environmentLabel}
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
                  className={
                    data.venue.current.environment === environment ? styles.currentVenue : ''
                  }
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
                {venueSplits.unknown.games} game{venueSplits.unknown.games === 1 ? '' : 's'}{' '}
                excluded because venue status is unknown.
              </p>
            )}
            {chartWindow === '2 YEARS' && data.venue.relevantInsight && (
              <p className={styles.labNote}>
                <b>
                  {data.venue.current.environment === 'INDOOR' ? 'Indoor check' : 'Outdoor check'}
                </b>{' '}
                {data.venue.relevantInsight}
              </p>
            )}
          </section>
        </>
      )}
      {tab === 'Line Ladder' && (
        <>
          <section className={styles.researchSection}>
            <header>
              <div>
                <small>How far can we push it?</small>
                <h3>Line ladder</h3>
                <p>
                  See how often {market.playerName} has reached each{' '}
                  {ladderDescriptionUnit(data.market.statType)} over this historical window — and
                  what you get at each line.
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
                    {chartWindowLabel} average: {ladderAverage ?? '—'} · Median:{' '}
                    {ladderMedian ?? '—'} · Highest: {ladderHighest ?? '—'}
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
        </>
      )}
      {tab === 'Matchup' && (
        <>
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
                  {data.opponentVsPosition.qualification}. Sample counts are qualifying
                  performances.
                </p>
              </>
            ) : (
              <p>Limited opponent sample.</p>
            )}
          </section>
        </>
      )}
      {tab === 'Game Log' && (
        <>
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
                  {data.usage.trendPct >= 0 ? 'up' : 'down'} {Math.abs(data.usage.trendPct)}% from
                  the previous five.
                </p>
              )}
            </section>
          )}
        </>
      )}
      {tab === 'Line Ladder' && (
        <>
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
                  {data.consistency.withinMiddle50} of {data.consistency.games} recent games landed
                  in the middle range of {data.consistency.middle50Range[0]}–
                  {data.consistency.middle50Range[1]} {activeStatName.toLowerCase()}.
                </p>
                <small>
                  {data.consistency.outlierCount} statistical outlier
                  {data.consistency.outlierCount === 1 ? '' : 's'} in this sample.
                </small>
              </div>
            </details>
          )}
        </>
      )}
      {tab === 'Matchup' && (
        <>
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
        </>
      )}
      {tab === 'Game Log' && (
        <>
          <details className={styles.chartAccordion}>
            <summary>Where does he usually land?</summary>
            <div>
              <ResultDistributionChart bins={data.distribution.bins} line={market.line ?? 0} />
              <p>{data.distribution.sampleSize} historical games in this sample.</p>
            </div>
          </details>
        </>
      )}
      <button className={styles.askContext} onClick={onAsk}>
        Ask the Lab about this
      </button>
      <p>Trend score is a research ranking, not a probability or prediction.</p>
    </>
  );
}
