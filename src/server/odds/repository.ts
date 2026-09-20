import { classifyStoredLine } from './line-classification';
import { authDb } from '@/server/auth/database';
import type { NormalizedOddsMarket } from './normalization';
import { SPORTSBOOK_IDS } from './sportsbooks';

const visibleSportsbooks = new Set<string>(SPORTSBOOK_IDS);

export type OddsEventInput = {
  providerEventId: string;
  season: number;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: Date;
  status: string;
};

export async function upsertOddsEvent(input: OddsEventInput) {
  const rows = await authDb()<Array<{ id: string; marketsLocked: boolean }>>`
    INSERT INTO sportsbook_events (provider, provider_event_id, league, season, week, home_team_id, away_team_id, kickoff_at, status, last_imported_at)
    VALUES ('SPORTSGAMEODDS', ${input.providerEventId}, 'NFL', ${input.season}, ${input.week}, ${input.homeTeamId}, ${input.awayTeamId}, ${input.kickoffAt}, ${input.status}, now())
    ON CONFLICT (provider, provider_event_id) DO UPDATE SET
      season=EXCLUDED.season, week=EXCLUDED.week, home_team_id=EXCLUDED.home_team_id,
      away_team_id=EXCLUDED.away_team_id, kickoff_at=EXCLUDED.kickoff_at,
      status=EXCLUDED.status, last_imported_at=now(), updated_at=now()
    RETURNING id, markets_locked AS "marketsLocked"`;
  return rows[0];
}

export async function upsertMarket(
  eventId: string,
  providerEventId: string,
  market: NormalizedOddsMarket,
) {
  const db = authDb();
  const existing = await db<Array<{ id: string }>>`
    SELECT id FROM bet_markets
    WHERE event_id=${eventId} AND (
      normalized_key=${market.normalizedKey}
      OR (
        provider_market_id=${market.providerMarketId}
        AND side=${market.side}
        AND line_key=coalesce(${market.line}::numeric, -999999::numeric)
      )
    )
    LIMIT 1`;
  let marketId = existing[0]?.id;
  if (marketId) {
    await db`
      UPDATE bet_markets SET market_type=${market.marketType}, stat_id=${market.statId},
        entity_id=${market.entityId}, player_id=${market.playerId}, team_id=${market.teamId},
        period=${market.period}, is_alt_line=${market.isAltLine},
        provider_market_name=${market.providerMarketName},
        normalization_status=${market.normalizationStatus},
        raw_provider_metadata=${db.json(JSON.parse(JSON.stringify(market.rawProviderMetadata)))},
        updated_at=now()
      WHERE id=${marketId}`;
  } else {
    const rows = await db<Array<{ id: string }>>`
      INSERT INTO bet_markets (event_id, provider_market_id, market_type, stat_id, entity_id, player_id, team_id, period, side, line, normalized_key, is_alt_line, provider_market_name, normalization_status, raw_provider_metadata)
      VALUES (${eventId}, ${market.providerMarketId}, ${market.marketType}, ${market.statId}, ${market.entityId}, ${market.playerId}, ${market.teamId}, ${market.period}, ${market.side}, ${market.line}, ${market.normalizedKey}, ${market.isAltLine}, ${market.providerMarketName}, ${market.normalizationStatus}, ${db.json(JSON.parse(JSON.stringify(market.rawProviderMetadata)))})
      RETURNING id`;
    marketId = rows[0].id;
  }
  for (const price of market.prices) {
    await db`
      INSERT INTO sportsbook_prices (market_id, sportsbook, provider_selection_id, provider_market_id, provider_event_id, odds, line, available, deeplink, updated_at)
      VALUES (${marketId}, ${price.sportsbook}, ${price.providerSelectionId}, ${market.providerMarketId}, ${providerEventId}, ${price.odds}, ${price.line}, ${price.available}, ${price.deeplink}, now())
      ON CONFLICT (market_id, sportsbook) DO UPDATE SET provider_selection_id=EXCLUDED.provider_selection_id,
        odds=EXCLUDED.odds, line=EXCLUDED.line, available=EXCLUDED.available,
        deeplink=EXCLUDED.deeplink, updated_at=now()`;
    await db`INSERT INTO sportsbook_price_snapshots (market_id, sportsbook, odds, line, available, deeplink) VALUES (${marketId}, ${price.sportsbook}, ${price.odds}, ${price.line}, ${price.available}, ${price.deeplink})`;
  }
  return marketId;
}

export async function lockStartedOddsEvents(now = new Date()) {
  const rows = await authDb()<Array<{ id: string }>>`
    UPDATE sportsbook_events SET markets_locked=true, status='started', updated_at=now()
    WHERE markets_locked=false AND kickoff_at <= ${now} RETURNING id`;
  return rows.length;
}

export async function markFinalSnapshot(eventId: string) {
  await authDb()`UPDATE sportsbook_events SET final_snapshot_at=COALESCE(final_snapshot_at, now()), updated_at=now() WHERE id=${eventId}`;
}

export async function mark24HourRefresh(eventId: string) {
  await authDb()`UPDATE sportsbook_events SET refreshed_24h_at=COALESCE(refreshed_24h_at, now()), updated_at=now() WHERE id=${eventId}`;
}

export async function upsertTeamMapping(providerTeamId: string, teamId: string) {
  if (!providerTeamId) return;
  await authDb()`INSERT INTO provider_team_mappings (provider, provider_team_id, team_id) VALUES ('SPORTSGAMEODDS', ${providerTeamId}, ${teamId}) ON CONFLICT (provider, provider_team_id) DO UPDATE SET team_id=EXCLUDED.team_id, updated_at=now()`;
}

export async function upsertPlayerMapping(
  providerPlayerId: string,
  playerId: string,
  providerName: string,
) {
  await authDb()`INSERT INTO provider_player_mappings (provider, provider_player_id, player_id, provider_name) VALUES ('SPORTSGAMEODDS', ${providerPlayerId}, ${playerId}, ${providerName}) ON CONFLICT (provider, provider_player_id) DO UPDATE SET player_id=EXCLUDED.player_id, provider_name=EXCLUDED.provider_name, updated_at=now()`;
}

export async function listLocalOddsEvents() {
  return authDb()`SELECT id, provider_event_id AS "providerEventId", season, week, home_team_id AS "homeTeamId", away_team_id AS "awayTeamId", kickoff_at AS "kickoffAt", status, markets_locked AS "marketsLocked", final_snapshot_at AS "finalSnapshotAt", refreshed_24h_at AS "refreshed24hAt", last_imported_at AS "lastImportedAt" FROM sportsbook_events WHERE kickoff_at > now() ORDER BY kickoff_at`;
}

export async function getLocalEventMarkets(
  eventId: string,
  filters: {
    marketType?: string;
    playerId?: string;
    sportsbook?: string;
    minLine?: number;
    maxLine?: number;
  } = {},
) {
  const db = authDb();
  const rows = await db`
    SELECT m.id, m.market_type AS "marketType", m.stat_id AS "statId", m.entity_id AS "entityId",
      m.player_id AS "playerId", pm.provider_name AS "playerName", m.team_id AS "teamId", m.period, m.side, m.line,
      m.normalized_key AS "normalizedKey", m.is_alt_line AS "isAltLine", m.raw_provider_metadata AS "rawProviderMetadata",
      p.sportsbook, p.odds, p.available, p.deeplink
    FROM bet_markets m
    JOIN sportsbook_prices p ON p.market_id=m.id
    LEFT JOIN provider_player_mappings pm
      ON pm.provider='SPORTSGAMEODDS' AND pm.provider_player_id=m.entity_id
    WHERE m.event_id=${eventId}
      AND (${filters.marketType ?? null}::text IS NULL OR m.market_type=${filters.marketType ?? null})
      AND (${filters.playerId ?? null}::text IS NULL OR m.player_id=${filters.playerId ?? null})
      AND (${filters.sportsbook ?? null}::text IS NULL OR p.sportsbook=${filters.sportsbook ?? null})
      AND (${filters.minLine ?? null}::numeric IS NULL OR m.line >= ${filters.minLine ?? null})
      AND (${filters.maxLine ?? null}::numeric IS NULL OR m.line <= ${filters.maxLine ?? null})
    ORDER BY m.market_type, m.line, p.sportsbook`;
  return rows
    .filter((row) => visibleSportsbooks.has(String(row.sportsbook)))
    .map((row) => {
      const { rawProviderMetadata, ...market } = row;
      return {
        ...market,
        ...classifyStoredLine({
          sportsbook: String(row.sportsbook),
          line: row.line,
          isAltLine: row.isAltLine,
          rawProviderMetadata,
        }),
      };
    });
}

export async function findLocalOddsEvent(homeTeamId: string, awayTeamId: string, season: number) {
  const rows = await authDb()<
    Array<{
      id: string;
      providerEventId: string;
      homeTeamId: string;
      awayTeamId: string;
      kickoffAt: Date;
    }>
  >`
    SELECT id, provider_event_id AS "providerEventId", home_team_id AS "homeTeamId", away_team_id AS "awayTeamId", kickoff_at AS "kickoffAt"
    FROM sportsbook_events WHERE home_team_id=${homeTeamId} AND away_team_id=${awayTeamId} AND season=${season}
    ORDER BY kickoff_at LIMIT 1`;
  return rows[0] ?? null;
}
