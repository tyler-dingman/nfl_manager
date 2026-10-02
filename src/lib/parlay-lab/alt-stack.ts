import type { HomeMarket } from '../../../packages/parlay/research';
import type { GeneratorGame } from './generator';
import { normalizeHistoricalStatType } from '../../server/historical-stats/stat-resolver';

export const ALT_STACK_MARKETS = [
  'RECEIVING_YARDS',
  'RUSHING_YARDS',
  'PASSING_YARDS',
  'RECEPTIONS',
  'PASSING_TDS',
  'ANYTIME_TD',
] as const;
export type AltStackConfig = {
  legs: number;
  targetOdds: number;
  minHits: number;
  games: string[];
  markets: string[];
};
export const DEFAULT_ALT_STACK: AltStackConfig = {
  legs: 8,
  targetOdds: -350,
  minHits: 9,
  games: [],
  markets: [...ALT_STACK_MARKETS.slice(0, 4)],
};
export type AltStackLeg = HomeMarket & {
  mainLine: number;
  line: number;
  odds: number;
  eventId: string;
  playerId: string;
  altScore: number;
  cushion: number;
};
export const altKey = (m: Pick<HomeMarket, 'id' | 'sportsbook'>) => `${m.id}:${m.sportsbook}`;
export const altThreshold = (m: Pick<HomeMarket, 'line'>) => `${Math.floor(m.line ?? 0) + 1}+`;

/** Adapter boundary: accepts the same priced, researched markets used throughout Parlay Lab. */
export function rankAltStackCandidates(
  markets: HomeMarket[],
  events: GeneratorGame[],
  config: AltStackConfig,
  now = Date.now(),
): AltStackLeg[] {
  const available = new Set(
    events
      .filter(
        (e) =>
          !e.marketsLocked &&
          Date.parse(e.kickoffAt) > now &&
          (!config.games.length || config.games.includes(e.id)),
      )
      .map((e) => e.id),
  );
  const ranked: AltStackLeg[] = [];
  const seen = new Set<string>();
  for (const m of markets) {
    const type = normalizeHistoricalStatType(m.marketType) ?? normalizeHistoricalStatType(m.statId);
    const line = m.line == null ? NaN : Number(m.line);
    const main = m.mainLine == null ? NaN : Number(m.mainLine);
    const odds = m.odds == null ? NaN : Number(m.odds);
    const t = m.trend;
    if (
      !m.eventId ||
      !available.has(m.eventId) ||
      !m.available ||
      !m.playerId ||
      !m.playerName ||
      m.period !== 'game' ||
      m.side !== 'OVER' ||
      m.lineType !== 'alternate' ||
      !type ||
      !config.markets.includes(type) ||
      !Number.isFinite(line) ||
      !Number.isFinite(main) ||
      Math.floor(line) + 1 >= main ||
      !Number.isFinite(odds) ||
      Math.abs(odds) < 100 ||
      !t ||
      t.last10.games !== 10 ||
      t.last10.hits < config.minHits ||
      t.last5.games < 5
    )
      continue;
    const cushion = main - (Math.floor(line) + 1);
    const historical = t.last10.hits / 10;
    const recent = t.last5.hits / t.last5.games;
    const longWindow = t.last20 ?? t.season;
    const season = longWindow.games ? longWindow.hits / longWindow.games : historical;
    const priceDistance =
      Math.abs(Math.log(Math.abs(odds) / Math.abs(config.targetOdds))) + (odds > 0 ? 1 : 0);
    const expensivePenalty = odds < -600 ? (Math.abs(odds) - 600) / 100 : 0;
    const altScore =
      historical * 35 +
      recent * 25 +
      season * 10 +
      Math.min(cushion / Math.max(main, 1), 0.5) * 10 +
      Math.min(t.last2Years.games, 20) / 4 -
      priceDistance * 24 -
      expensivePenalty;
    if (seen.has(altKey(m))) continue;
    seen.add(altKey(m));
    ranked.push({
      ...m,
      line,
      mainLine: main,
      odds,
      playerId: m.playerId,
      eventId: m.eventId,
      cushion,
      altScore,
    });
  }
  return ranked.sort((a, b) => b.altScore - a.altScore || altKey(a).localeCompare(altKey(b)));
}

export function selectAltStack(pool: AltStackLeg[], count: number) {
  // A stack must be buildable at one sportsbook, with at most one leg per player.
  const choices = [...new Set(pool.map((m) => m.sportsbook))]
    .map((book) => {
      const players = new Set<string>();
      return pool
        .filter((m) => {
          if (m.sportsbook !== book || players.has(m.playerId)) return false;
          players.add(m.playerId);
          return true;
        })
        .slice(0, count);
    })
    .sort(
      (a, b) =>
        b.length - a.length ||
        b.reduce((s, m) => s + m.altScore, 0) - a.reduce((s, m) => s + m.altScore, 0),
    );
  const best = choices[0] ?? [];
  return { legs: best.length === count ? best : [], available: best.length };
}

export function swapAltStackLeg(
  pool: AltStackLeg[],
  legs: AltStackLeg[],
  index: number,
  excluded: string[] = [],
) {
  const current = legs[index];
  if (!current) return null;
  const players = new Set(legs.map((m) => m.playerId));
  return (
    pool.find(
      (m) =>
        m.sportsbook === current.sportsbook &&
        !players.has(m.playerId) &&
        !excluded.includes(altKey(m)),
    ) ?? null
  );
}
