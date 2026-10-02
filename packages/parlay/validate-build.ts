import type { HomeMarket } from './research';
type Game = { id: string; kickoffAt: string; marketsLocked?: boolean };
/** Refresh a proposed build without silently accepting a changed price, line or game. */
type Candidate = Pick<HomeMarket, 'id' | 'sportsbook' | 'eventId' | 'available' | 'line' | 'odds' | 'side'> & {trend?: {trendScore:number} | null};
export function validateParlayBuild<T extends Candidate>(
  legs: Candidate[],
  markets: T[],
  events: Game[],
  minScore = 0,
  now = Date.now(),
) {
  return legs.map((leg) =>
    markets.find(
      (m) =>
        m.id === leg.id &&
        m.sportsbook === leg.sportsbook &&
        m.available &&
        m.line === leg.line &&
        m.odds === leg.odds &&
        m.side === leg.side &&
        (m.trend?.trendScore ?? -1) >= minScore &&
        events.some((e) => e.id === m.eventId && !e.marketsLocked && Date.parse(e.kickoffAt) > now),
    ),
  );
}
