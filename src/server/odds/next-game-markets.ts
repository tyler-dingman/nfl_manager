import type { CanonicalGame } from '@/lib/canonical-game';
import type { Market } from '@/components/parlay-lab/ParlayLabPage';
import { getLocalEventMarkets, listLocalOddsEvents } from './repository';
import { sportsbookLineLabel } from '@/components/parlay-lab/market-display';

/** Presentation of existing Parlay Lab rows, with no provider calls or duplicate storage. */
export async function nextGameMarkets(
  game: CanonicalGame,
  stores = { listLocalOddsEvents, getLocalEventMarkets },
) {
  const events = await stores.listLocalOddsEvents();
  const matches = events.filter(
    (event) =>
      !event.marketsLocked &&
      event.homeTeamId === game.homeTeam &&
      event.awayTeamId === game.awayTeam &&
      game.kickoffAt &&
      Math.abs(new Date(event.kickoffAt).getTime() - Date.parse(game.kickoffAt)) < 3600000,
  );
  if (matches.length !== 1) return null;
  const eventId = String(matches[0].id);
  const markets = (await stores.getLocalEventMarkets(eventId)) as unknown as Market[];
  const available = markets.filter(
    (m) => m.available && m.odds != null && Number.isFinite(Number(m.odds)),
  );
  if (!available.length) return null;
  const main = available.filter(
    (m) =>
      m.period.toLowerCase() === 'game' &&
      !m.playerId &&
      (m.lineType === 'main' || (m.lineType !== 'alternate' && !m.isAltLine)) &&
      (m.marketType !== 'TOTAL' || m.entityId.toLowerCase() === 'all') &&
      ['SPREAD', 'TOTAL', 'MONEYLINE'].includes(m.marketType),
  );
  // Keep all displayed markets on one saved sportsbook's lines, preferring fuller coverage.
  const books = [...new Set(main.map((m) => m.sportsbook))];
  const coverage = (book: string) =>
    new Set(main.filter((m) => m.sportsbook === book).map((m) => m.marketType)).size;
  books.sort((a, b) => coverage(b) - coverage(a));
  const rows = main.filter((m) => m.sportsbook === books[0]);
  const validTeam = (m: Market) => [game.homeTeam, game.awayTeam].includes(m.teamId ?? '');
  const spread = rows.find(
    (m) =>
      m.marketType === 'SPREAD' &&
      validTeam(m) &&
      m.line != null &&
      Number.isFinite(Number(m.line)) &&
      Number(m.line) <= 0,
  );
  const total = rows.find(
    (m) => m.marketType === 'TOTAL' && m.line != null && Number.isFinite(Number(m.line)),
  );
  const moneylines = rows
    .filter((m) => m.marketType === 'MONEYLINE' && validTeam(m))
    .sort((a, b) => Number(a.odds) - Number(b.odds));
  const moneyline =
    moneylines[0] &&
    Number(moneylines[0].odds) < 0 &&
    ((moneylines[1] &&
      moneylines[0].teamId !== moneylines[1].teamId &&
      Number(moneylines[0].odds) < Number(moneylines[1].odds)) ||
      (spread?.teamId === moneylines[0].teamId && Number(spread.line) < 0))
      ? moneylines[0]
      : null;
  return {
    eventId,
    spread: spread
      ? `${spread.teamId} ${sportsbookLineLabel({ ...spread, line: Number(spread.line) })}`
      : null,
    total: total ? `O/U ${Number(total.line)}` : null,
    moneyline: moneyline ? `${moneyline.teamId} ${Number(moneyline.odds)}` : null,
  };
}
export type NextGameMarkets = Awaited<ReturnType<typeof nextGameMarkets>>;
