import type { HistoricalPlayerGame, HistoricalStatType } from './types';
import { resolveHistoricalStat } from './stat-resolver';

/** Positional production allowed, grouped by game so committees do not inflate sample size. */
export function recentMatchupEvidence(
  logs: HistoricalPlayerGame[],
  stat: HistoricalStatType,
  asOf: string,
) {
  const games = new Map<string, { date: string; value: number }>();
  for (const g of logs) {
    const value = resolveHistoricalStat(g, stat);
    if (value == null || Date.parse(g.date) >= Date.parse(asOf)) continue;
    const old = games.get(g.gameId);
    games.set(g.gameId, { date: g.date, value: (old?.value ?? 0) + value });
  }
  const rows = [...games.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  if (rows.length < 8 || Date.parse(asOf) - Date.parse(rows[0]!.date) > 35 * 86400000) return null;
  const recent = rows.slice(0, 3),
    baseline = rows.slice(3, 13);
  const avg = (r: typeof rows) => r.reduce((s, g) => s + g.value, 0) / r.length;
  const mean = avg(baseline);
  const sd = Math.sqrt(baseline.reduce((s, g) => s + (g.value - mean) ** 2, 0) / baseline.length);
  return {
    signal: Math.max(-1, Math.min(1, (avg(recent) - mean) / Math.max(sd, Math.abs(mean) * 0.2, 1))),
    games: rows.length,
  };
}
