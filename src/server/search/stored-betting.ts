import { authDb } from '@/server/auth/database';
import type { SearchGame } from '@/features/search/answer-types';
import { SPORTSBOOKS } from '@/server/odds/sportsbooks';

export type OddsLine = {
  market: string;
  selection: string;
  line: number | null;
  price: number;
  sportsbook: string;
  updatedAt: string;
  playerName?: string | null;
  playerId?: string | null;
  eventId?: string;
  isAltLine?: boolean;
};

/** AI Search must never trigger SportsOdds API requests. Betting answers use stored data only.
 * This module has no ingestion/provider imports, fetch calls, refreshes or job queue access.
 * A missing row stays missing. Keep ingestion in sportsbookIngestionService.
 */
export async function getStoredGameOdds(game: SearchGame, db = authDb()): Promise<OddsLine[]> {
  const rows = await db`
    SELECT e.id AS event_id,m.market_type,m.side,m.team_id,m.player_id,m.is_alt_line,
      pm.provider_name AS player_name,p.line,p.odds,p.sportsbook,p.updated_at
    FROM sportsbook_events e
    JOIN bet_markets m ON m.event_id=e.id
    JOIN sportsbook_prices p ON p.market_id=m.id
    LEFT JOIN provider_player_mappings pm
      ON pm.provider='SPORTSGAMEODDS' AND pm.provider_player_id=m.entity_id
    WHERE e.home_team_id=${game.home} AND e.away_team_id=${game.away}
      AND abs(extract(epoch from (e.kickoff_at-${game.startsAt}::timestamptz))) < 3600
      AND e.markets_locked=false AND p.available=true
      AND lower(m.period)='game' AND m.normalization_status <> 'UNMAPPED'
      AND (m.market_type <> 'TOTAL' OR lower(m.entity_id)='all')
      AND ((m.market_type IN ('TOTAL','SPREAD','MONEYLINE') AND m.is_alt_line=false)
        OR pm.provider_name IS NOT NULL)
    ORDER BY p.updated_at DESC`;
  return rows
    .filter((r) => SPORTSBOOKS.some((b) => b.id === r.sportsbook))
    .map((r) => ({
      market: r.market_type,
      // Totals/props use Over/Under, not the player's team abbreviation.
      selection: ['TOTAL'].includes(r.market_type) || r.player_name ? r.side : r.team_id || r.side,
      line: r.line == null ? null : Number(r.line),
      price: r.odds == null ? NaN : Number(r.odds),
      sportsbook: r.sportsbook,
      updatedAt:
        r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at ?? ''),
      playerName: r.player_name,
      playerId: r.player_id,
      eventId: r.event_id,
      isAltLine: r.is_alt_line,
    }));
}

export function usableStoredOdds(lines: OddsLine[], now: Date) {
  return lines.filter(
    (l) =>
      SPORTSBOOKS.some((b) => b.id === l.sportsbook) &&
      Number.isFinite(l.price) &&
      Math.abs(l.price) >= 100 &&
      (l.line === null
        ? l.market === 'MONEYLINE' || l.market === 'TOUCHDOWNS'
        : Number.isFinite(l.line)) &&
      Number.isFinite(Date.parse(l.updatedAt)) &&
      Date.parse(l.updatedAt) <= now.getTime() + 60000,
  );
}

export function selectStoredProps(query: string, lines: OddsLine[]) {
  const q = query.toLowerCase().replace(/[’']/g, '');
  let props = lines.filter(
    (l) => l.playerName && !['TOTAL', 'SPREAD', 'MONEYLINE', 'OTHER'].includes(l.market),
  );
  const names = [...new Set(props.map((l) => l.playerName!))];
  const matched = names.filter((name) =>
    name
      .toLowerCase()
      .split(/\s+/)
      .some(
        (part) =>
          part.length > 2 &&
          new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`).test(q),
      ),
  );
  const generic =
    /^(what|whats|what are|what is|show|show me)?\s*(the |all |available )?(player )?(props?|touchdown odds)( are available)?[?.! ]*$/.test(
      q,
    );
  if (!matched.length && !generic) return [];
  if (
    matched.length > 1 &&
    new Set(matched.map((n) => n.toLowerCase().split(' ').at(-1))).size === 1
  )
    return [];
  if (matched.length) props = props.filter((l) => matched.includes(l.playerName!));
  const metric = /passing/.test(q)
    ? /touchdown|\btd\b/.test(q)
      ? 'PASSING_TD'
      : /attempt/.test(q)
        ? 'PASSING_ATTEMPTS'
        : /completion/.test(q)
          ? 'PASSING_COMPLETIONS'
          : 'PASSING_YARDS'
    : /receiving/.test(q)
      ? 'RECEIVING_YARDS'
      : /rushing/.test(q)
        ? 'RUSHING_YARDS'
        : /reception/.test(q)
          ? 'RECEPTIONS'
          : /touchdown|\btd\b/.test(q)
            ? matched.length === 1 && props.some((l) => l.market === 'PASSING_TD')
              ? 'PASSING_TD'
              : 'TOUCHDOWNS'
            : null;
  if (/receiving props/.test(q))
    props = props.filter((l) => l.market.startsWith('RECEIVING_') || l.market === 'RECEPTIONS');
  else if (metric) props = props.filter((l) => l.market === metric);
  return props;
}
