import type { HomeMarket } from './ParlayLabHome';
export type DirectoryPlayer = {
  id: string;
  name: string;
  position: string;
  teamAbbr: string;
  headshotUrl: string | null;
};
export type PlayerSummary = DirectoryPlayer & {
  market: HomeMarket;
  games: number;
  observations: number;
  hitRate: number | null;
  recentRate: number | null;
  change: number | null;
  score: number | null;
};
const score = (m: HomeMarket) => {
  const n = m.trend?.trendScore;
  return n != null && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};
/** One current main/unknown line per stat and period, using OVER consistently.
 * Historical rates are backtests against current lines, not settled betting results.
 * Alternate lines, opposite sides, books and future events cannot multiply observations.
 */
export function summarizePlayers(
  markets: HomeMarket[],
  roster: DirectoryPlayer[],
): PlayerSummary[] {
  const groups = new Map<string, HomeMarket[]>();
  for (const m of markets) {
    if (!m.available || !m.playerId || !m.playerName || !m.teamId) continue;
    const rows = groups.get(m.playerId) ?? [];
    rows.push(m);
    groups.set(m.playerId, rows);
  }
  return [...groups].map(([id, rows]) => {
    rows.sort((a, b) => (score(b) ?? -1) - (score(a) ?? -1));
    const market = rows[0];
    const profile = roster.find(
      (p) => p.id === id || (p.name === market.playerName && p.teamAbbr === market.teamId),
    );
    const stats = new Map<string, HomeMarket>();
    for (const m of rows) {
      if (m.side !== 'OVER' || m.lineType === 'alternate' || !m.trend?.gameLog?.length) continue;
      const key = `${m.statId || m.marketType}:${m.period}`;
      const old = stats.get(key);
      if (!old || (m.lineType === 'main' && old.lineType !== 'main')) stats.set(key, m);
    }
    const logs = [...stats.values()].flatMap((m) =>
      m
        .trend!.gameLog.filter(
          (g) =>
            Number.isFinite(g.statValue) &&
            Number.isFinite(g.line) &&
            Number.isFinite(Date.parse(g.date)),
        )
        .map((g) => ({ date: g.date, hit: g.statValue > g.line, push: g.statValue === g.line })),
    );
    const dates = [...new Set(logs.map((g) => g.date))]
      .sort((a, b) => Date.parse(b) - Date.parse(a))
      .slice(0, 10);
    const rate = (window: string[]) => {
      const sample = logs.filter((g) => window.includes(g.date) && !g.push);
      return sample.length ? (sample.filter((g) => g.hit).length / sample.length) * 100 : null;
    };
    const recent = rate(dates.slice(0, 5)),
      earlier = rate(dates.slice(5, 10));
    return {
      id,
      name: market.playerName!,
      teamAbbr: market.teamId!,
      position: profile?.position || market.position || '—',
      headshotUrl: market.headshotUrl || profile?.headshotUrl || null,
      market,
      games: dates.length,
      observations: logs.filter((g) => dates.includes(g.date) && !g.push).length,
      hitRate: rate(dates),
      recentRate: dates.length >= 5 ? recent : null,
      change: dates.length >= 10 && recent != null && earlier != null ? recent - earlier : null,
      score: score(market),
    };
  });
}
// Transparent ordering: recent aggregate rate, improvement, strongest current Lab Score, name.
export function rankPlayers(a: PlayerSummary, b: PlayerSummary) {
  return (
    (b.hitRate ?? -1) - (a.hitRate ?? -1) ||
    (b.change ?? -101) - (a.change ?? -101) ||
    (b.score ?? -1) - (a.score ?? -1) ||
    a.name.localeCompare(b.name)
  );
}
export function playerStatus(p: PlayerSummary) {
  if (p.games >= 10 && (p.hitRate ?? 0) >= 90)
    return {
      label: 'ELITE CONSISTENCY',
      text: `${Math.round(p.hitRate!)}% across ${p.observations} tracked observations · L10`,
      kind: 'consistent',
    };
  if (p.change != null && p.change >= 10)
    return {
      label: 'TRENDING UP',
      text: `+${Math.round(p.change)} percentage points · last 5 vs previous 5 games`,
      kind: 'up',
    };
  if (p.games >= 5 && (p.hitRate ?? 0) >= 80)
    return {
      label: 'HOT RIGHT NOW',
      text: `${Math.round(p.hitRate!)}% across ${p.observations} tracked observations · last ${p.games} games`,
      kind: 'hot',
    };
  return null;
}
