import { loadEnvConfig } from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
loadEnvConfig(process.cwd());
type AuditRow = {
  id: string;
  eventId: string;
  playerId: string;
  playerName: string | null;
  teamId: string | null;
  marketType: string;
  statId: string;
  period: string;
  side: string;
  line: number | null;
  sportsbook: string;
  odds: number;
  oddsUpdatedAt: Date;
  kickoffAt: Date;
  homeTeamId: string;
  awayTeamId: string;
  season: number;
  lineType: string;
};

async function main() {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw Error('Local database required');
  const { authDb } = await import('../src/server/auth/database');
  const db = authDb();
  try {
    const rows = await db<
      AuditRow[]
    >`SELECT m.id,m.event_id AS "eventId",m.player_id AS "playerId",pm.provider_name AS "playerName",m.team_id AS "teamId",m.market_type AS "marketType",m.stat_id AS "statId",m.period,m.side,m.line::float8,
 p.sportsbook,p.odds,p.updated_at AS "oddsUpdatedAt",e.kickoff_at AS "kickoffAt",e.home_team_id AS "homeTeamId",e.away_team_id AS "awayTeamId",e.season,
 CASE WHEN m.line=CASE WHEN m.raw_provider_metadata->'odd'->>'betTypeID'='sp' THEN (book.value->>'spread')::numeric ELSE (book.value->>'overUnder')::numeric END THEN 'main'
 WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(book.value->'altLines','[]'::jsonb)) alt WHERE m.line=CASE WHEN m.raw_provider_metadata->'odd'->>'betTypeID'='sp' THEN (alt->>'spread')::numeric ELSE (alt->>'overUnder')::numeric END) THEN 'alternate'
 WHEN m.is_alt_line THEN 'alternate' ELSE 'unknown' END AS "lineType"
 FROM sportsbook_events e JOIN bet_markets m ON m.event_id=e.id JOIN sportsbook_prices p ON p.market_id=m.id
 LEFT JOIN provider_player_mappings pm ON pm.provider=e.provider AND pm.provider_player_id=m.entity_id
 CROSS JOIN LATERAL (SELECT m.raw_provider_metadata->'odd'->'byBookmaker'->lower(p.sportsbook) AS value) book
 WHERE e.provider='SPORTSGAMEODDS' AND e.kickoff_at>now() AND NOT e.markets_locked AND p.available AND m.player_id IS NOT NULL
 ORDER BY p.updated_at DESC,m.id,p.sportsbook`;

    const eligible = rows.filter(
      (r) =>
        r.sportsbook === 'FANDUEL' &&
        r.period === 'game' &&
        r.playerName &&
        r.playerId &&
        r.line != null &&
        ['PASSING_YARDS', 'RUSHING_YARDS', 'RECEIVING_YARDS', 'RECEPTIONS'].includes(r.marketType),
    );
    const first = eligible.find((r) => r.lineType === 'main' && r.side === 'UNDER');
    if (!first) throw Error('No eligible standard Under');
    const second = eligible.find(
      (r) =>
        r.lineType === 'alternate' &&
        r.side === 'OVER' &&
        r.odds >= -1000 &&
        r.odds <= -200 &&
        r.eventId !== first.eventId &&
        r.playerId !== first.playerId,
    );
    if (!second) throw Error('No eligible alternate Over');
    const third = eligible.find(
      (r) =>
        r.lineType === 'main' &&
        ['OVER', 'UNDER'].includes(r.side) &&
        ![first.eventId, second.eventId].includes(r.eventId) &&
        ![first.playerId, second.playerId].includes(r.playerId),
    );
    if (!third) throw Error('No eligible third game');
    const legs = [first, second, third];
    await mkdir('reports/unabated-three-leg-audit', { recursive: true });
    await writeFile(
      'reports/unabated-three-leg-audit/selections.json',
      JSON.stringify({ selectedAt: new Date().toISOString(), legs }, null, 2),
      { flag: 'wx' },
    );
    console.log(JSON.stringify(legs));
  } finally {
    await db.end();
  }
}
main().catch(() => {
  console.error('Preparation stopped; no generation submitted.');
  process.exitCode = 1;
});
