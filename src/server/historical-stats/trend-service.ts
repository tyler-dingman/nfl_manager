import { didHit, resolveHistoricalStat } from './stat-resolver';
import type { HistoricalPlayerGame, HistoricalStatType } from './types';

type WindowResult = { games: number; hits: number; hitRate: number | null };
const rounded = (value: number) => Math.round(value * 10) / 10;
const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const windowResult = (values: number[], line: number, side: string): WindowResult => ({
  games: values.length,
  hits: values.filter((value) => didHit(value, line, side)).length,
  hitRate: values.length
    ? rounded((values.filter((value) => didHit(value, line, side)).length / values.length) * 100)
    : null,
});
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};
const consistency = (values: number[], line: number) => {
  if (values.length < 2) return null;
  const avg = mean(values)!;
  const sd = Math.sqrt(values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length);
  return Math.max(0, Math.min(100, Math.round(100 - (sd / Math.max(Math.abs(line), 1)) * 100)));
};

export type PlayerTrendInput = {
  playerId: string;
  statType: HistoricalStatType;
  line: number;
  side: 'OVER' | 'UNDER';
  currentOpponentId?: string;
  currentHomeAway?: 'HOME' | 'AWAY';
  season?: number;
};

export function calculatePlayerPropTrend(games: HistoricalPlayerGame[], input: PlayerTrendInput) {
  const rows = games
    .filter((g) => g.playerId === input.playerId)
    .map((game) => ({ game, value: resolveHistoricalStat(game, input.statType) }))
    .filter((row): row is { game: HistoricalPlayerGame; value: number } => row.value !== null)
    .sort((a, b) => new Date(b.game.date).getTime() - new Date(a.game.date).getTime());
  const values = rows.map((r) => r.value),
    last5Values = values.slice(0, 5),
    last10Values = values.slice(0, 10);
  const latestSeason = input.season ?? Math.max(...rows.map((r) => r.game.season), 0),
    seasonRows = rows.filter((r) => r.game.season === latestSeason),
    opponentRows = input.currentOpponentId
      ? rows.filter((r) => r.game.opponentTeamId === input.currentOpponentId)
      : [],
    homeRows = rows.filter((r) => r.game.homeAway === 'HOME'),
    awayRows = rows.filter((r) => r.game.homeAway === 'AWAY'),
    relevant =
      input.currentHomeAway === 'HOME'
        ? homeRows
        : input.currentHomeAway === 'AWAY'
          ? awayRows
          : [];
  const all = windowResult(values, input.line, input.side),
    last5 = windowResult(last5Values, input.line, input.side),
    last10 = windowResult(last10Values, input.line, input.side),
    season = windowResult(
      seasonRows.map((r) => r.value),
      input.line,
      input.side,
    ),
    vsOpponent = windowResult(
      opponentRows.map((r) => r.value),
      input.line,
      input.side,
    ),
    home = windowResult(
      homeRows.map((r) => r.value),
      input.line,
      input.side,
    ),
    away = windowResult(
      awayRows.map((r) => r.value),
      input.line,
      input.side,
    );
  const hitSequence = rows.map((r) => didHit(r.value, input.line, input.side)),
    streakType = hitSequence.length ? (hitSequence[0] ? 'HIT' : 'MISS') : null;
  let streakLength = 0;
  for (const hit of hitSequence) {
    if ((hit ? 'HIT' : 'MISS') !== streakType) break;
    streakLength++;
  }
  const avg = mean(values),
    consistencyScore = consistency(last10Values, input.line),
    sampleConfidence = values.length >= 10 ? 'HIGH' : values.length >= 5 ? 'MEDIUM' : 'LOW';
  const signals: Array<[number, number | null]> = [
    [30, last10.hitRate],
    [20, last5.hitRate],
    [
      15,
      avg === null
        ? null
        : Math.max(
            0,
            Math.min(
              100,
              50 +
                ((input.side === 'UNDER' ? input.line - avg : avg - input.line) /
                  Math.max(Math.abs(input.line), 1)) *
                  100,
            ),
          ),
    ],
    [10, vsOpponent.games >= 2 ? vsOpponent.hitRate : null],
    [
      10,
      relevant.length
        ? windowResult(
            relevant.map((r) => r.value),
            input.line,
            input.side,
          ).hitRate
        : null,
    ],
    [10, consistencyScore],
    [5, values.length >= 10 ? 100 : values.length >= 5 ? 60 : 25],
  ];
  const used = signals.filter((s): s is [number, number] => s[1] !== null),
    weight = used.reduce((sum, s) => sum + s[0], 0),
    trendScore = weight ? Math.round(used.reduce((sum, [w, v]) => sum + w * v, 0) / weight) : 0;
  return {
    last5,
    last10,
    season,
    last2Years: all,
    vsOpponent: { ...vsOpponent, average: mean(opponentRows.map((r) => r.value)) },
    home: { ...home, average: mean(homeRows.map((r) => r.value)) },
    away: { ...away, average: mean(awayRows.map((r) => r.value)) },
    average: avg === null ? null : rounded(avg),
    median: median(values),
    recentAverage5: mean(last5Values),
    recentAverage10: mean(last10Values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    averageVsLine: avg === null ? null : rounded(avg - input.line),
    streakType,
    streakLength,
    consistencyScore,
    trendScore,
    sampleConfidence,
    vsOpponentConfidence:
      opponentRows.length >= 5 ? 'HIGH' : opponentRows.length >= 2 ? 'MEDIUM' : 'LOW',
    gameLog: rows.slice(0, 10).map(({ game, value }) => ({
      date: game.date,
      opponent: game.opponentTeamId,
      homeAway: game.homeAway,
      statValue: value,
      line: input.line,
      result: didHit(value, input.line, input.side) ? 'HIT' : 'MISS',
    })),
  };
}
