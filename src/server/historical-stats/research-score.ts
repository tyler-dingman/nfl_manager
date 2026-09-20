import { didHit, resolveHistoricalStat } from './stat-resolver';
import { calculatePlayerUsageTrend } from './player-usage-trend-service';
import type { HistoricalPlayerGame, HistoricalStatType, TeamSeasonStrength } from './types';

export type Alignment = 'supports' | 'neutral' | 'conflicts' | 'unknown';
export type ScoreContext = {
  strength?: TeamSeasonStrength | null;
  position?: string | null;
  lineType?: 'main' | 'alternate' | 'unknown';
  mainLine?: number | null;
  spread?: number | null;
};
const clamp = (n: number, min = -1, max = 1) => Math.max(min, Math.min(max, n));
const alignment = (n: number | null): Alignment =>
  n === null ? 'unknown' : Math.abs(n) < 0.1 ? 'neutral' : n > 0 ? 'supports' : 'conflicts';
const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

// Rank semantics are verified in team-season-strength-service: fewest allowed ranks first.
// Yardage ranks are not TD, interception, reception, or combined-player defense metrics.
export function directionalMatchup(
  stat: HistoricalStatType,
  side: 'OVER' | 'UNDER',
  context: ScoreContext,
) {
  const position = context.position?.toUpperCase();
  const pass =
    ['PASSING_YARDS', 'PASSING_ATTEMPTS', 'PASSING_COMPLETIONS'].includes(stat) &&
    position === 'QB';
  const receiving = stat === 'RECEIVING_YARDS' && ['RB', 'WR', 'TE'].includes(position ?? '');
  const rush = ['RUSHING_YARDS', 'RUSHING_ATTEMPTS'].includes(stat) && position === 'RB';
  const rank =
    pass || receiving
      ? context.strength?.passDefenseRank
      : rush
        ? context.strength?.rushDefenseRank
        : null;
  const valid = rank != null && Number.isFinite(rank) && rank >= 1 && rank <= 32;
  const productionSignal = valid ? (rank - 16.5) / 15.5 : null;
  const signal = productionSignal === null ? null : productionSignal * (side === 'UNDER' ? -1 : 1);
  const volume = ['RUSHING_ATTEMPTS', 'PASSING_ATTEMPTS', 'PASSING_COMPLETIONS'].includes(stat);
  const maxAdjustment = volume ? 3 : 8;
  const state = alignment(signal);
  const sideLabel = side === 'UNDER' ? 'Under' : 'Over';
  return {
    alignment: state,
    signal,
    productionSignal,
    rank: valid ? rank : null,
    adjustment: signal === null ? 0 : signal * maxAdjustment,
    metric: pass || receiving ? 'Team pass yards allowed' : rush ? 'Team rush yards allowed' : null,
    contextualOnly: volume || receiving,
    label:
      state === 'unknown'
        ? 'Matchup context unavailable'
        : state === 'neutral'
          ? `Neutral for ${sideLabel}`
          : state === 'supports'
            ? `Supports ${sideLabel}`
            : `Works Against ${sideLabel}`,
  };
}

export function calculateResearchScore(
  games: HistoricalPlayerGame[],
  input: ScoreContext & {
    playerId: string;
    statType: HistoricalStatType;
    line: number;
    side: 'OVER' | 'UNDER';
  },
) {
  const rows = games
    .filter((g) => g.playerId === input.playerId)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const values = rows
    .map((g) => resolveHistoricalStat(g, input.statType))
    .filter((v): v is number => v !== null)
    .slice(0, 10);
  const position = input.position ?? rows[0]?.position;
  const matchup = directionalMatchup(input.statType, input.side, { ...input, position });
  const baseline = values.length ? avg(values) : null;
  const sorted = [...values].sort((a, b) => a - b);
  const median = values.length
    ? (sorted[Math.floor((values.length - 1) / 2)]! + sorted[Math.floor(values.length / 2)]!) / 2
    : null;
  const sd = baseline === null ? null : Math.sqrt(avg(values.map((v) => (v - baseline) ** 2)));
  const alternate = input.lineType === 'alternate';
  const hasMain = alternate && input.mainLine != null && Number.isFinite(input.mainLine);
  // All threshold-dependent score evidence is anchored to the same-book main line.
  // Actual selected-line statistics remain unchanged in the research response.
  const scoringLine = hasMain ? input.mainLine! : input.line;
  const mainKnown = input.lineType === 'main' || hasMain;
  const contextReliability = mainKnown ? 1 : 0.75;
  const sampleReliability = Math.min(values.length / 10, 1);
  const sign = input.side === 'UNDER' ? -1 : 1;
  const hits = values.length
    ? values.filter((v) => didHit(v, scoringLine, input.side)).length / values.length
    : null;
  const trendSignal = hits === null ? 0 : 2 * hits - 1;
  const scale = Math.max(sd ?? 0, Math.abs(baseline ?? 0) * 0.2, 1);
  const lineDelta = baseline === null ? null : input.line - baseline;
  const scoringDelta = baseline === null ? null : scoringLine - baseline;
  const elevated = scoringDelta !== null && Math.abs(scoringDelta) >= scale;
  const consistentWithMatchup = !!(
    elevated &&
    matchup.productionSignal !== null &&
    Math.abs(matchup.productionSignal) >= 0.25 &&
    Math.sign(scoringDelta!) === Math.sign(matchup.productionSignal)
  );
  // Do not treat a contextually consistent baseline displacement as a full independent cushion.
  const cushionSignal =
    baseline === null
      ? 0
      : clamp((sign * (baseline - scoringLine)) / (2 * scale)) * (consistentWithMatchup ? 0.5 : 1);
  const consistencyReliability = sd === null ? 0 : 1 / (1 + sd / Math.max(Math.abs(baseline!), 1));
  const historicalAdjustment =
    40 *
    (0.65 * trendSignal + 0.35 * cushionSignal) *
    sampleReliability *
    contextReliability *
    (0.75 + 0.25 * consistencyReliability);
  const usage = calculatePlayerUsageTrend(rows, input.statType);
  const usageSupported = !['ANYTIME_TD', 'INTERCEPTIONS'].includes(input.statType);
  const usageSignal =
    usageSupported && usage.series.length >= 10 && usage.trendPct !== null
      ? clamp((sign * usage.trendPct) / 30)
      : null;
  const usageAdjustment = usageSignal === null ? 0 : usageSignal * 5;
  const spread = input.spread;
  const rushingVolume =
    position === 'RB' && ['RUSHING_YARDS', 'RUSHING_ATTEMPTS'].includes(input.statType);
  const passingVolume =
    position === 'QB' &&
    ['PASSING_YARDS', 'PASSING_ATTEMPTS', 'PASSING_COMPLETIONS'].includes(input.statType);
  const scriptSignal =
    spread != null && Number.isFinite(spread) && (rushingVolume || passingVolume)
      ? clamp((rushingVolume ? -spread : spread) / 10) * sign
      : null;
  const scriptAdjustment = scriptSignal === null ? 0 : scriptSignal * 2;
  const matchupAdjustment = matchup.adjustment;
  const score = Math.round(
    clamp(
      50 +
        historicalAdjustment +
        sampleReliability * (matchupAdjustment + usageAdjustment + scriptAdjustment),
      0,
      100,
    ),
  );
  return {
    version: 'side-aware-v1',
    score,
    matchup,
    lineContext: {
      baseline,
      median,
      lineDelta,
      scoringLine,
      mainLine: hasMain ? input.mainLine! : input.lineType === 'main' ? input.line : null,
      alternateDelta: hasMain ? input.line - input.mainLine! : null,
      consistentWithMatchup,
      explanation: consistentWithMatchup
        ? `The ${scoringDelta! > 0 ? 'higher' : 'lower'} market threshold relative to recent history is directionally consistent with the yardage matchup context. This does not establish why the sportsbook set it.`
        : null,
      scoreBasis: hasMain
        ? 'Known main line; selected-line hit rates are descriptive'
        : mainKnown
          ? 'Main line'
          : 'Unverified main-line context; historical evidence attenuated',
    },
    breakdown: {
      trend: {
        alignment: alignment(hits === null ? null : trendSignal),
        signal: hits === null ? null : trendSignal,
      },
      lineCushion: {
        alignment: alignment(baseline === null ? null : cushionSignal),
        signal: baseline === null ? null : cushionSignal,
      },
      consistency: { reliability: consistencyReliability },
      historical: { adjustment: historicalAdjustment },
      usage: { alignment: alignment(usageSignal), adjustment: usageAdjustment * sampleReliability },
      matchup: { alignment: matchup.alignment, adjustment: matchupAdjustment * sampleReliability },
      gameContext: {
        alignment: alignment(scriptSignal),
        adjustment: scriptAdjustment * sampleReliability,
      },
      sampleQuality: { games: values.length, reliability: sampleReliability },
    },
  };
}
