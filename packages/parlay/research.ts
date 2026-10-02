import type {
  calculateResearchScore,
  Alignment,
} from '../../src/server/historical-stats/research-score';
import type { Market } from './market';
type Trend = {
  last5: { games: number; hits: number; hitRate: number | null };
  last10: { games: number; hits: number; hitRate: number | null };
  last20?: { games: number; hits: number; hitRate: number | null };
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

export type OddsEvent = {
  id: string;
  season?: number;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string;
};
