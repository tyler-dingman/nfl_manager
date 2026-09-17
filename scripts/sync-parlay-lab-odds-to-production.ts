import { loadEnvConfig } from '@next/env';
import postgres, { type Sql } from 'postgres';

const BATCH_SIZE = 500;
const batches = <T>(rows: T[]) => {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    result.push(rows.slice(index, index + BATCH_SIZE));
  }
  return result;
};

async function syncMappings(source: Sql, target: Sql) {
  const teams = await source`SELECT provider, provider_team_id, team_id, created_at, updated_at FROM provider_team_mappings`;
  for (const batch of batches(teams)) {
    await target`
      INSERT INTO provider_team_mappings ${target(batch, 'provider', 'provider_team_id', 'team_id', 'created_at', 'updated_at')}
      ON CONFLICT (provider, provider_team_id) DO UPDATE SET
        team_id=EXCLUDED.team_id, updated_at=EXCLUDED.updated_at`;
  }
  const players = await source`SELECT provider, provider_player_id, player_id, provider_name, confidence, created_at, updated_at FROM provider_player_mappings`;
  for (const batch of batches(players)) {
    await target`
      INSERT INTO provider_player_mappings ${target(batch, 'provider', 'provider_player_id', 'player_id', 'provider_name', 'confidence', 'created_at', 'updated_at')}
      ON CONFLICT (provider, provider_player_id) DO UPDATE SET
        player_id=EXCLUDED.player_id, provider_name=EXCLUDED.provider_name,
        confidence=EXCLUDED.confidence, updated_at=EXCLUDED.updated_at`;
  }
  return { teamMappings: teams.length, playerMappings: players.length };
}

async function main() {
  loadEnvConfig(process.cwd());
  if (!process.argv.includes('--confirm-production')) {
    throw new Error('Production sync refused. Add --confirm-production after reviewing the audit.');
  }
  const localUrl = process.env.DATABASE_URL;
  const productionUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!localUrl || !productionUrl) throw new Error('DATABASE_URL and PRODUCTION_DATABASE_URL are required');
  if (localUrl === productionUrl) throw new Error('Local and production database targets must be different');
  console.log('Source environment: local');
  console.log('Target environment: production');
  const source = postgres(localUrl, { max: 1, ssl: false });
  const target = postgres(productionUrl, { max: 1, ssl: 'require' });
  try {
    const mappingSummary = await syncMappings(source, target);
    const events = await source`
      SELECT provider, provider_event_id, league, season, week, home_team_id, away_team_id,
        kickoff_at, status, markets_locked, first_imported_at, refreshed_24h_at,
        final_snapshot_at, last_imported_at, created_at, updated_at
      FROM sportsbook_events WHERE kickoff_at > now() ORDER BY kickoff_at`;
    let marketCount = 0;
    let priceCount = 0;
    for (const event of events) {
      const [productionEvent] = await target<Array<{ id: string }>>`
        INSERT INTO sportsbook_events ${target([event], 'provider', 'provider_event_id', 'league', 'season', 'week', 'home_team_id', 'away_team_id', 'kickoff_at', 'status', 'markets_locked', 'first_imported_at', 'refreshed_24h_at', 'final_snapshot_at', 'last_imported_at', 'created_at', 'updated_at')}
        ON CONFLICT (provider, provider_event_id) DO UPDATE SET
          season=EXCLUDED.season, week=EXCLUDED.week, home_team_id=EXCLUDED.home_team_id,
          away_team_id=EXCLUDED.away_team_id, kickoff_at=EXCLUDED.kickoff_at,
          status=EXCLUDED.status, markets_locked=EXCLUDED.markets_locked,
          refreshed_24h_at=EXCLUDED.refreshed_24h_at,
          final_snapshot_at=EXCLUDED.final_snapshot_at,
          last_imported_at=EXCLUDED.last_imported_at, updated_at=EXCLUDED.updated_at
        RETURNING id`;
      const localMarkets = await source`
        SELECT m.provider_market_id, m.market_type, m.stat_id, m.entity_id, m.player_id,
          m.team_id, m.period, m.side, m.line, m.normalized_key, m.is_alt_line,
          m.provider_market_name, m.normalization_status, m.raw_provider_metadata,
          m.created_at, m.updated_at
        FROM bet_markets m JOIN sportsbook_events e ON e.id=m.event_id
        WHERE e.provider=${event.provider} AND e.provider_event_id=${event.provider_event_id}`;
      const markets: Record<string, unknown>[] = localMarkets.map((market) => ({
        ...market,
        event_id: productionEvent.id,
      }));
      for (const batch of batches(markets)) {
        await target`
          INSERT INTO bet_markets ${target(batch, 'event_id', 'provider_market_id', 'market_type', 'stat_id', 'entity_id', 'player_id', 'team_id', 'period', 'side', 'line', 'normalized_key', 'is_alt_line', 'provider_market_name', 'normalization_status', 'raw_provider_metadata', 'created_at', 'updated_at')}
          ON CONFLICT (event_id, normalized_key) DO UPDATE SET
            market_type=EXCLUDED.market_type, stat_id=EXCLUDED.stat_id,
            entity_id=EXCLUDED.entity_id, player_id=EXCLUDED.player_id,
            team_id=EXCLUDED.team_id, period=EXCLUDED.period,
            is_alt_line=EXCLUDED.is_alt_line,
            provider_market_name=EXCLUDED.provider_market_name,
            normalization_status=EXCLUDED.normalization_status,
            raw_provider_metadata=EXCLUDED.raw_provider_metadata,
            updated_at=EXCLUDED.updated_at`;
      }
      const localPrices = await source`
        SELECT m.normalized_key, p.sportsbook, p.provider_selection_id, p.provider_market_id,
          p.provider_event_id, p.odds, p.decimal_odds, p.line, p.available, p.deeplink,
          p.captured_at, p.updated_at
        FROM sportsbook_prices p
        JOIN bet_markets m ON m.id=p.market_id
        JOIN sportsbook_events e ON e.id=m.event_id
        WHERE e.provider=${event.provider} AND e.provider_event_id=${event.provider_event_id}`;
      const productionMarkets = await target<Array<{ id: string; normalizedKey: string }>>`
        SELECT id, normalized_key AS "normalizedKey" FROM bet_markets
        WHERE event_id=${productionEvent.id}`;
      const marketIds = new Map(productionMarkets.map((market) => [market.normalizedKey, market.id]));
      const prices: Record<string, unknown>[] = localPrices.flatMap((price) => {
        const marketId = marketIds.get(String(price.normalized_key));
        return marketId ? [{ ...price, market_id: marketId }] : [];
      });
      for (const batch of batches(prices)) {
        await target`
          INSERT INTO sportsbook_prices ${target(batch, 'market_id', 'sportsbook', 'provider_selection_id', 'provider_market_id', 'provider_event_id', 'odds', 'decimal_odds', 'line', 'available', 'deeplink', 'captured_at', 'updated_at')}
          ON CONFLICT (market_id, sportsbook) DO UPDATE SET
            provider_selection_id=EXCLUDED.provider_selection_id,
            provider_market_id=EXCLUDED.provider_market_id,
            provider_event_id=EXCLUDED.provider_event_id, odds=EXCLUDED.odds,
            decimal_odds=EXCLUDED.decimal_odds, line=EXCLUDED.line,
            available=EXCLUDED.available, deeplink=EXCLUDED.deeplink,
            captured_at=EXCLUDED.captured_at, updated_at=EXCLUDED.updated_at`;
      }
      marketCount += markets.length;
      priceCount += prices.length;
      console.log(`Synced ${event.away_team_id} @ ${event.home_team_id}: ${markets.length} markets, ${prices.length} prices`);
    }
    console.table({
      Events: events.length,
      Markets: marketCount,
      Prices: priceCount,
      'Team mappings': mappingSummary.teamMappings,
      'Player mappings': mappingSummary.playerMappings,
    });
  } finally {
    await Promise.all([source.end(), target.end()]);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
