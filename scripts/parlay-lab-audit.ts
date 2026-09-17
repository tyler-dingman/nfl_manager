import { loadEnvConfig } from '@next/env';
import postgres, { type Sql } from 'postgres';

const NFL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB',
  'HOU', 'IND', 'JAX', 'KC', 'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WAS',
] as const;

const REQUIRED_COLUMNS: Record<string, string[]> = {
  sportsbook_events: [
    'id', 'provider_event_id', 'season', 'week', 'home_team_id', 'away_team_id',
    'kickoff_at', 'markets_locked', 'last_imported_at',
  ],
  bet_markets: [
    'id', 'event_id', 'market_type', 'stat_id', 'entity_id', 'player_id', 'team_id',
    'period', 'side', 'line', 'normalized_key', 'is_alt_line', 'provider_market_name',
    'normalization_status', 'raw_provider_metadata',
  ],
  sportsbook_prices: ['market_id', 'sportsbook', 'odds', 'line', 'available', 'deeplink'],
  sportsbook_price_snapshots: ['market_id', 'sportsbook', 'odds', 'line', 'available'],
  provider_team_mappings: ['provider', 'provider_team_id', 'team_id'],
  provider_player_mappings: [
    'provider', 'provider_player_id', 'player_id', 'provider_name', 'confidence',
  ],
  historical_games: [
    'id', 'season', 'week', 'season_type', 'provider_game_id', 'game_date',
    'home_team_id', 'away_team_id',
  ],
  historical_player_games: [
    'game_id', 'season', 'week', 'player_id', 'provider_player_id', 'team_id',
    'opponent_team_id', 'position', 'passing_attempts', 'passing_completions',
    'passing_yards', 'passing_tds', 'interceptions', 'carries', 'rushing_yards',
    'rushing_tds', 'targets', 'receptions', 'receiving_yards', 'receiving_tds',
  ],
  historical_team_games: ['game_id', 'season', 'week', 'team_id', 'opponent_team_id'],
  historical_team_season_strength: [
    'season', 'team_id', 'pass_defense_rank', 'rush_defense_rank',
    'scoring_defense_rank', 'total_defense_rank',
  ],
};

type Target = 'local' | 'production';

function requestedTargets(): Target[] {
  const value = process.argv.find((arg) => arg.startsWith('--database='))?.split('=')[1];
  if (!value || value === 'local') return ['local'];
  if (value === 'production') return ['production'];
  if (value === 'both') return ['local', 'production'];
  throw new Error('Use --database=local, --database=production, or --database=both');
}

function connectionFor(target: Target) {
  const value = target === 'production' ? process.env.PRODUCTION_DATABASE_URL : process.env.DATABASE_URL;
  if (!value) {
    throw new Error(
      `${target === 'production' ? 'PRODUCTION_DATABASE_URL' : 'DATABASE_URL'} is required`,
    );
  }
  return value;
}

async function scalar(sql: Sql, query: string) {
  const rows = await sql.unsafe<Array<{ value: string | number | null }>>(query);
  return rows[0]?.value ?? 0;
}

async function audit(target: Target) {
  const connection = connectionFor(target);
  const sql = postgres(connection, {
    max: 1,
    ssl: connection.includes('localhost') || connection.includes('127.0.0.1') ? false : 'require',
  });
  try {
    const tables = await sql<Array<{ tableName: string }>>`
      SELECT table_name AS "tableName"
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY(${Object.keys(REQUIRED_COLUMNS)})
    `;
    const existing = new Set(tables.map((row) => row.tableName));
    const schemaRows: Array<{ table: string; status: string; missingColumns: string }> = [];
    for (const [table, required] of Object.entries(REQUIRED_COLUMNS)) {
      if (!existing.has(table)) {
        schemaRows.push({ table, status: 'MISSING', missingColumns: required.join(', ') });
        continue;
      }
      const columns = await sql<Array<{ columnName: string }>>`
        SELECT column_name AS "columnName" FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table}
      `;
      const available = new Set(columns.map((row) => row.columnName));
      const missing = required.filter((column) => !available.has(column));
      schemaRows.push({
        table,
        status: missing.length ? 'FAIL' : 'PASS',
        missingColumns: missing.join(', ') || '—',
      });
    }

    console.log(`\nPARLAY LAB DATA AUDIT — ${target.toUpperCase()}\n${'='.repeat(48)}`);
    console.log(`Environment: ${target}`);
    console.table(schemaRows);
    if (!existing.has('historical_player_games') || !existing.has('historical_games')) {
      console.log('Historical coverage: unavailable (required tables are missing)');
    } else {
      const coverage = await sql<
        Array<{
          statRows: number;
          mappedPlayers: number;
          teams: number;
          seasons: string | null;
          latestGame: string | null;
          latestSeason: number | null;
          latestWeek: number | null;
        }>
      >`
        SELECT count(*)::int AS "statRows",
          count(DISTINCT player_id) FILTER (WHERE player_id IS NOT NULL)::int AS "mappedPlayers",
          count(DISTINCT team_id)::int AS teams,
          string_agg(DISTINCT h.season::text, ', ' ORDER BY h.season::text) AS seasons,
          max(g.game_date)::text AS "latestGame",
          (array_agg(h.season ORDER BY g.game_date DESC, h.week DESC))[1] AS "latestSeason",
          (array_agg(h.week ORDER BY g.game_date DESC, h.week DESC))[1] AS "latestWeek"
        FROM historical_player_games h JOIN historical_games g ON g.id = h.game_id
      `;
      const positions = await sql<Array<{ position: string; players: number; rows: number }>>`
        SELECT coalesce(position, 'UNKNOWN') AS position,
          count(DISTINCT player_id) FILTER (WHERE player_id IS NOT NULL)::int AS players,
          count(*)::int AS rows
        FROM historical_player_games GROUP BY position ORDER BY position
      `;
      const coveredTeams = await sql<Array<{ teamId: string }>>`
        SELECT DISTINCT team_id AS "teamId" FROM historical_player_games ORDER BY team_id
      `;
      const coveredTeamIds = new Set(coveredTeams.map((row) => row.teamId));
      const missingTeams = NFL_TEAMS.filter((teamId) => !coveredTeamIds.has(teamId));
      console.table(coverage);
      console.table(positions);
      console.log(`Missing team data: ${missingTeams.join(', ') || 'NONE'}`);

      const integrity = {
        'Duplicate games': await scalar(sql, `SELECT count(*) AS value FROM (SELECT provider, provider_game_id FROM historical_games GROUP BY 1,2 HAVING count(*) > 1) d`),
        'Duplicate player/game stats': await scalar(sql, `SELECT count(*) AS value FROM (SELECT season, week, season_type, provider, provider_player_id, game_id FROM historical_player_games GROUP BY 1,2,3,4,5,6 HAVING count(*) > 1) d`),
        'Orphan player stats': await scalar(sql, `SELECT count(*) AS value FROM historical_player_games h LEFT JOIN historical_games g ON g.id=h.game_id WHERE g.id IS NULL`),
        'Missing canonical player ID': await scalar(sql, `SELECT count(*) AS value FROM historical_player_games WHERE player_id IS NULL`),
        'Invalid player-stat team': await scalar(sql, `SELECT count(*) AS value FROM historical_player_games WHERE team_id <> ALL(ARRAY[${NFL_TEAMS.map((team) => `'${team}'`).join(',')}]) OR opponent_team_id <> ALL(ARRAY[${NFL_TEAMS.map((team) => `'${team}'`).join(',')}])`),
        'Missing season/week': await scalar(sql, `SELECT count(*) AS value FROM historical_player_games WHERE season IS NULL OR week IS NULL`),
      };
      console.table(integrity);
    }

    if (existing.has('sportsbook_events') && existing.has('bet_markets') && existing.has('sportsbook_prices')) {
      const odds = await sql`
        SELECT
          (SELECT count(*)::int FROM sportsbook_events) AS "allEvents",
          (SELECT count(*)::int FROM sportsbook_events WHERE kickoff_at > now()) AS "upcomingEvents",
          (SELECT count(*)::int FROM bet_markets) AS markets,
          (SELECT count(*)::int FROM sportsbook_prices) AS prices,
          (SELECT count(DISTINCT sportsbook)::int FROM sportsbook_prices) AS sportsbooks,
          (SELECT max(last_imported_at)::text FROM sportsbook_events) AS "latestImport"
      `;
      console.table(odds);
    } else {
      console.log('Odds coverage: unavailable (required tables are missing)');
    }
    return schemaRows.every((row) => row.status === 'PASS');
  } finally {
    await sql.end();
  }
}

async function main() {
  loadEnvConfig(process.cwd());
  let passed = true;
  for (const target of requestedTargets()) passed = (await audit(target)) && passed;
  if (!passed) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
