'use client';
import type { calculateResearchScore, Alignment } from '@/server/historical-stats/research-score';

import { DashboardContent, type GeneratorSetup, type DashboardMode } from './dashboard-content';
import { DashboardShell } from './dashboard-shell';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';

import { useEffect, useState, useRef } from 'react';
import { useParlayTeamContext } from './use-parlay-team';
import { TEAM_LIST } from '@/data/teams';
import { sportsbookName } from '@/server/odds/sportsbooks';
import RideTheBusDrawer from './RideTheBusDrawer';
import { ladderDescriptionUnit, marketDisplayName } from '@/lib/parlay-lab/market-display';
import { buildSportsbookLink, type Market } from './ParlayLabPage';
import PlayerAvatar from './PlayerAvatar';
import MyParlayPanel from './MyParlayPanel';
import { snapshotSavedPlay } from './saved-plays';
import styles from './parlay-home.module.css';
import ResearchWorkspace from './ResearchWorkspace';

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
export function ParlayLabHome({
  mode = 'home',
  initialEventId,
}: {
  mode?: DashboardMode;
  initialEventId?: string;
}) {
  const searchParams = useSearchParams();
  const { team: creatorTeam, ready: teamReady } = useParlayTeamContext();
  const router = useRouter();
  useEffect(() => {
    if (
      mode !== 'games' ||
      !teamReady ||
      !creatorTeam ||
      searchParams?.get('team') === creatorTeam.abbr
    )
      return;
    const params = new URLSearchParams(searchParams?.toString());
    params.set('team', creatorTeam.abbr);
    router.replace(`/parlay-lab/games?${params}`, { scroll: false });
  }, [mode, teamReady, creatorTeam, router, searchParams]);
  const [generatorSetup, setGeneratorSetup] = useState<GeneratorSetup | undefined>();
  const [marketState, setMarketState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [marketError, setMarketError] = useState('');
  const [marketRetry, setMarketRetry] = useState(0);
  const [events, setEvents] = useState<OddsEvent[]>([]),
    [eventId, setEventId] = useState(''),
    [markets, setMarkets] = useState<HomeMarket[]>([]),
    [trendingMarkets, setTrendingMarkets] = useState<HomeMarket[]>([]),
    [heroMarkets, setHeroMarkets] = useState<HomeMarket[]>([]),
    [slip, setSlip] = useState<HomeMarket[]>([]),
    [rideOpen, setRideOpen] = useState(false),
    [detail, setDetail] = useState<HomeMarket | null>(null),
    [detailData, setDetailData] = useState<ResearchDetail | null>(null),
    [chartWindow, setChartWindow] = useState<'L5' | 'L10' | 'SEASON' | '2 YEARS'>('L10');
  const [buildLoaded, setBuildLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('down-distance-parlay-lab-current') ?? '[]');
      if (Array.isArray(saved)) setSlip(saved);
    } catch {}
    setBuildLoaded(true);
  }, []);
  useEffect(() => {
    if (buildLoaded) localStorage.setItem('down-distance-parlay-lab-current', JSON.stringify(slip));
  }, [slip, buildLoaded]);
  useEffect(() => {
    setMarketState('loading');
    setTrendingMarkets([]);
    setMarketError('');
    setHeroMarkets([]);
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
      .catch(() => {});
  }, [eventId]);
  useEffect(() => {
    if (!events.length) return;
    const controller = new AbortController();
    setTrendingMarkets([]);
    setMarketState('loading');
    setMarketError('');
    fetch(`/api/parlay-lab/research?eventId=${encodeURIComponent('ALL')}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Markets unavailable');
        return response.json();
      })
      .then((body) => {
        if (!controller.signal.aborted) {
          setTrendingMarkets((body.markets ?? []).filter((market: HomeMarket) => market.available));
          setHeroMarkets(body.markets ?? []);
          setMarketState('ready');
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setMarketError('Markets could not be loaded. Please try again.');
          setMarketState('error');
        }
      });
    return () => controller.abort();
  }, [events]);
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
  const slipEvent = events.find((e) => slip.length > 0 && slip.every((m) => m.eventId === e.id));
  return (
    <DashboardShell team={creatorTeam}>
      <RideTheBusDrawer
        team={creatorTeam}
        marketState={marketState}
        marketError={marketError}
        onRetry={() => setMarketRetry((value) => value + 1)}
        open={rideOpen}
        onClose={() => setRideOpen(false)}
        markets={
          generatorSetup?.eventId && generatorSetup.eventId !== 'ALL'
            ? trendingMarkets.filter((m) => m.eventId === generatorSetup.eventId)
            : trendingMarkets
        }
        initialPrompt={generatorSetup?.prompt}
        initialLegCount={generatorSetup?.legs}
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
      <DashboardContent
        onRemove={(id) => setSlip((rows) => rows.filter((market) => market.id !== id))}
        mode={mode}
        team={creatorTeam}
        markets={heroMarkets}
        events={events}
        loading={marketState === 'loading'}
        error={marketError}
        onOpen={openResearch}
        onAdd={add}
        slip={slip}
        onGenerate={(setup) => {
          setGeneratorSetup(setup);
          setRideOpen(true);
        }}
        initialEventId={initialEventId ?? searchParams?.get('game') ?? undefined}
        parlay={
          <MyParlayPanel
            legs={slip}
            markets={[...markets, ...trendingMarkets]}
            matchup={slipEvent ? `${slipEvent.awayTeamId} @ ${slipEvent.homeTeamId}` : 'NFL'}
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
                  event: slipEvent ?? null,
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
        }
      />
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
                    (item) => item.id === candidate.id && item.sportsbook === candidate.sportsbook,
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
    </DashboardShell>
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
