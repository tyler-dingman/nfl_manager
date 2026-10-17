import { loadEnvConfig } from '@next/env';
import { writeFile } from 'node:fs/promises';
loadEnvConfig(process.cwd());
async function main() {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw Error('Local database required');
  const { authDb } = await import('../src/server/auth/database');
  const db = authDb();
  try {
    const rows =
      await db`SELECT m.id,m.event_id AS "eventId",pm.provider_name AS "playerName",m.market_type AS "marketType",m.side,m.line::float8,p.odds,p.updated_at AS "oddsUpdatedAt",e.kickoff_at AS "kickoffAt",e.away_team_id AS "awayTeamId",e.home_team_id AS "homeTeamId"
FROM bet_markets m JOIN sportsbook_events e ON e.id=m.event_id JOIN sportsbook_prices p ON p.market_id=m.id
JOIN provider_player_mappings pm ON pm.provider=e.provider AND pm.provider_player_id=m.entity_id
WHERE e.provider='SPORTSGAMEODDS' AND e.kickoff_at>now() AND NOT e.markets_locked AND p.sportsbook='FANDUEL' AND p.available
AND m.period='game' AND m.market_type='PASSING_YARDS' AND m.side='OVER'
AND EXISTS (SELECT 1 FROM bet_markets u JOIN sportsbook_prices up ON up.market_id=u.id WHERE u.event_id=m.event_id AND u.entity_id=m.entity_id AND u.market_type=m.market_type AND u.period=m.period AND u.line=m.line AND u.side='UNDER' AND up.sportsbook='FANDUEL' AND up.available)
ORDER BY (e.away_team_id='CHI' OR e.home_team_id='CHI') DESC,p.updated_at DESC,m.line LIMIT 1`;
    if (!rows[0]) throw Error('No stored available pair');
    const o = rows[0];
    const unders =
      await db`SELECT u.id,u.side,u.line::float8,up.odds,up.updated_at AS "oddsUpdatedAt" FROM bet_markets u JOIN sportsbook_prices up ON up.market_id=u.id JOIN bet_markets o ON o.id=${o.id} WHERE u.event_id=o.event_id AND u.entity_id=o.entity_id AND u.market_type=o.market_type AND u.period=o.period AND u.line=o.line AND u.side='UNDER' AND up.sportsbook='FANDUEL' AND up.available LIMIT 1`;
    const pilot = [o, { ...o, ...unders[0] }];
    await writeFile(
      'reports/unabated-direction-audit/sample.json',
      JSON.stringify(
        {
          seed: 'direction-pair-v1',
          selectedAt: new Date().toISOString(),
          availability:
            'Stored available flags; sportsbook availability not yet independently verified',
          pilot,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(pilot));
  } finally {
    await db.end();
  }
}
main().catch(() => {
  console.error('Pair selection failed');
  process.exitCode = 1;
});
