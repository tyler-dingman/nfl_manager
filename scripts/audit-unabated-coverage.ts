import { loadEnvConfig } from '@next/env';
import { writeFile } from 'node:fs/promises';
import { UnabatedClient } from '../src/server/providers/unabated/client';
import { flattenUnabatedProps, coverageCounts } from '../src/server/providers/unabated/coverage';
loadEnvConfig(process.cwd());
async function main() {
  // No paid legacy requests, writes to odds tables, or automatic production access.
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL ?? '').hostname)
  )
    throw new Error('Coverage audit requires a local DATABASE_URL.');
  const { authDb } = await import('../src/server/auth/database');
  const db = authDb();
  const client = new UnabatedClient();
  try {
    const report = await db.reserve().then(async (connection) => {
      try {
        const [lock] = await connection`SELECT pg_try_advisory_lock(721946103) AS acquired`;
        if (!lock.acquired) throw new Error('Another Unabated audit is running.');
        // Compact server-side aggregation; raw bookmaker JSON never leaves PostgreSQL.
        const baseline = await connection`
          SELECT e.id AS "localEventId", e.home_team_id AS "homeTeam", e.away_team_id AS "awayTeam",
            e.kickoff_at AS kickoff, e.week, e.season, m.market_type AS market, p.sportsbook,
            count(*)::int AS offers,
            count(*) FILTER (WHERE m.line = CASE WHEN m.raw_provider_metadata->'odd'->>'betTypeID'='sp'
              THEN (m.raw_provider_metadata->'odd'->'byBookmaker'->lower(p.sportsbook)->>'spread')::numeric
              ELSE (m.raw_provider_metadata->'odd'->'byBookmaker'->lower(p.sportsbook)->>'overUnder')::numeric END)::int AS standard,
            count(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM jsonb_array_elements(COALESCE(m.raw_provider_metadata->'odd'->'byBookmaker'->lower(p.sportsbook)->'altLines','[]'::jsonb)) alt
              WHERE m.line = CASE WHEN m.raw_provider_metadata->'odd'->>'betTypeID'='sp'
                THEN (alt->>'spread')::numeric ELSE (alt->>'overUnder')::numeric END
            ) AND m.line IS DISTINCT FROM CASE WHEN m.raw_provider_metadata->'odd'->>'betTypeID'='sp'
              THEN (m.raw_provider_metadata->'odd'->'byBookmaker'->lower(p.sportsbook)->>'spread')::numeric
              ELSE (m.raw_provider_metadata->'odd'->'byBookmaker'->lower(p.sportsbook)->>'overUnder')::numeric END)::int AS alternate,
            count(*) FILTER (WHERE p.deeplink IS NOT NULL)::int AS "withDeepLinks",
            count(*) FILTER (WHERE p.provider_selection_id IS NOT NULL)::int AS "withProviderSelectionIds",
            min(p.updated_at) AS "oldestStoredUpdate", max(p.updated_at) AS "newestStoredUpdate"
          FROM sportsbook_events e JOIN bet_markets m ON m.event_id=e.id JOIN sportsbook_prices p ON p.market_id=m.id
          WHERE e.provider='SPORTSGAMEODDS' AND e.kickoff_at > now() AND e.kickoff_at < now()+interval '7 days'
            AND NOT e.markets_locked AND m.player_id IS NOT NULL AND p.available
          GROUP BY e.id,m.market_type,p.sportsbook ORDER BY e.kickoff_at,m.market_type,p.sportsbook`;
        let unabated: unknown = {
          status: 'blocked',
          reason: 'UNABATED_API_KEY is not configured; coverage is unknown, not zero.',
        };
        if (process.env.UNABATED_API_KEY) {
          try {
            // Discovery first: no numeric league/book/bet-type identifiers are hardcoded.
            const leagues = await client.leagues();
            if (!leagues.some((l) => l.name.toLowerCase() === 'nfl'))
              throw new Error('NFL not returned by league discovery.');
            const betTypes = await client.betTypes();
            const periods = await client.periods();
            const sources = await client.sources();
            const people = await client.people();
            const teams = await client.teams();
            const board = await client.odds();
            const sourceById = new Map(sources.map((s) => [s.id, s]));
            const rows = flattenUnabatedProps(board).filter(
              (r) => Date.parse(r.eventStart!) < Date.now() + 7 * 86400000,
            );
            const fanduel = sources.find(
              (s) => s.name.toLowerCase().replace(/\s/g, '') === 'fanduel',
            );
            const bearsPlayers = new Set(
              Object.values(people)
                .filter((p) => p.teamId != null && teams[String(p.teamId)]?.abbreviation === 'CHI')
                .map((p) => p.id),
            );
            const bearsEvents = new Set(
              rows.filter((r) => bearsPlayers.has(r.personId)).map((r) => r.eventId),
            );
            unabated = {
              status: 'shadow-only',
              lastUpdated: board.lastUpdated,
              counts: coverageCounts(rows),
              fanDuel: coverageCounts(rows.filter((r) => r.marketSourceId === fanduel?.id)),
              bears: coverageCounts(rows.filter((r) => bearsEvents.has(r.eventId))),
              bearsFanDuel: coverageCounts(
                rows.filter((r) => bearsEvents.has(r.eventId) && r.marketSourceId === fanduel?.id),
              ),
              betTypes,
              periods,
              sources,
              teams,
              // Compact selection context supports subsequent exact event/player/threshold mapping review.
              selections: rows.map((r) => ({
                ...r,
                deepLink: r.deepLink ? '[present]' : null,
                playerName: [
                  people[String(r.personId)]?.firstName,
                  people[String(r.personId)]?.lastName,
                ]
                  .filter(Boolean)
                  .join(' '),
                sourceName: sourceById.get(r.marketSourceId!)?.name ?? null,
              })),
              pending:
                'Verify market/period/player/event mappings and identical game sets before comparing normalized coverage. No database ingestion or transfer enabled.',
            };
          } catch (error) {
            unabated = {
              status: 'blocked',
              reason: error instanceof Error ? error.message : 'Unabated audit failed',
            };
          }
        }
        return {
          generatedAt: new Date().toISOString(),
          productionChanged: false,
          credentials: {
            apiKeyConfigured: Boolean(process.env.UNABATED_API_KEY),
            partnerCodeConfigured: Boolean(process.env.UNABATED_PARTNER_CODE),
          },
          legacyApiRequests: 0,
          baseline,
          unabated,
          apiUsage: client.usage,
          notes: [
            'Counts are sportsbook offers, including both directions. Standard and alternate are classified per sportsbook using stored provider metadata; unclassified offers remain in the total.',
            'Provider selection IDs may be synthesized legacy IDs; they are not verified sportsbook selection IDs.',
            'The live comparison and Bears missing-player/threshold audit remain pending until credentials and mappings are verified.',
          ],
        };
      } finally {
        await connection`SELECT pg_advisory_unlock(721946103)`;
        connection.release();
      }
    });
    await writeFile('reports/unabated-coverage.json', JSON.stringify(report, null, 2) + '\n');
    console.log('Saved reports/unabated-coverage.json; no odds rows modified.');
    console.log(
      JSON.stringify({
        baselineGroups: report.baseline.length,
        unabated: (report.unabated as { status: string }).status,
        usage: report.apiUsage,
      }),
    );
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Coverage audit failed');
  process.exitCode = 1;
});
