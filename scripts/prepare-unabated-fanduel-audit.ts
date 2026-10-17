import { loadEnvConfig } from '@next/env';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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
const seed = 'downanddistance-fanduel-2026-10-10-v1';
const category = (market: string, line: number | null, stat: string, period: string) =>
  market === 'TOUCHDOWNS' &&
  !(stat === 'touchdowns' && period === 'game' && (line === 0.5 || line == null))
    ? 'Other existing markets'
    : ({
        PASSING_YARDS: 'Passing yards',
        PASSING_TD: 'Passing touchdowns',
        RUSHING_YARDS: 'Rushing yards',
        RUSHING_ATTEMPTS: 'Rushing attempts',
        RECEIVING_YARDS: 'Receiving yards',
        RECEPTIONS: 'Receptions',
        TOUCHDOWNS: 'Anytime touchdowns',
        RUSHING_RECEIVING_YARDS: 'Combined yards',
        PASSING_RUSHING_YARDS: 'Combined yards',
      }[market] ?? 'Other existing markets');
const band = (n: number) =>
  n > 0
    ? 'Positive'
    : n >= -199
      ? '-100 to -199'
      : n >= -349
        ? '-200 to -349'
        : n >= -499
          ? '-350 to -499'
          : n >= -749
            ? '-500 to -749'
            : n >= -1000
              ? '-750 to -1000'
              : 'Below -1000';
const hash = (v: string) =>
  createHash('sha256')
    .update(seed + '|' + v)
    .digest('hex');
async function main() {
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL ?? '').hostname)
  )
    throw Error('Local database required.');
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
 ORDER BY e.kickoff_at,m.id,p.sportsbook`;
    const { getTrendingProps } =
      await import('../src/server/historical-stats/trending-props-service');
    const scores = new Map<string, { score: number | null; teamId: string | null }>();
    const events = [...new Map(rows.map((r) => [r.eventId, r])).values()];
    for (const e of events) {
      const researched = await getTrendingProps(
        e.eventId,
        { [e.homeTeamId]: e.awayTeamId, [e.awayTeamId]: e.homeTeamId },
        e.season,
        { homeTeamId: e.homeTeamId, awayTeamId: e.awayTeamId },
        'all',
      );
      for (const r of researched)
        scores.set(r.id + '|' + r.sportsbook, {
          score: r.trend?.trendScore ?? null,
          teamId: r.teamId,
        });
      console.log('Scored event', e.eventId);
    }
    const offers = rows.map((r) => ({
      ...r,
      teamId: r.teamId ?? scores.get(r.id + '|' + r.sportsbook)?.teamId ?? null,
      labScore: scores.get(r.id + '|' + r.sportsbook)?.score ?? null,
      category: category(r.marketType, r.line, r.statId, r.period),
      oddsBand: band(r.odds),
    }));
    const unique = [...new Map(offers.map((r) => [r.id, r])).values()];
    const fd = offers.filter((r) => r.sportsbook === 'FANDUEL');
    const fdIds = new Set(fd.map((r) => r.id));
    const without = unique.filter((r) => !fdIds.has(r.id));
    const pool = fd.filter(
      (r) =>
        r.period === 'game' &&
        r.odds >= -1000 &&
        r.playerName &&
        ['OVER', 'UNDER', 'YES', 'NO'].includes(r.side),
    );
    const buckets = new Map<string, typeof pool>();
    for (const r of pool) {
      const key = [
        r.marketType === 'TOUCHDOWNS' ? 'Other existing markets' : r.category,
        r.lineType,
        r.side,
        r.oddsBand,
        r.labScore == null ? 'unknown' : r.labScore >= 70 ? 'high' : 'low',
      ].join('|');
      const b = buckets.get(key) ?? [];
      b.push(r);
      buckets.set(key, b);
    }
    const strata = [...buckets].map(([key, values]) => ({
      key,
      values: values.sort((a, b) => hash(a.id).localeCompare(hash(b.id))),
      quota: Math.floor((200 * values.length) / pool.length),
      fraction: ((200 * values.length) / pool.length) % 1,
    }));
    let remaining = Math.min(200, pool.length) - strata.reduce((n, s) => n + s.quota, 0);
    for (const s of [...strata].sort(
      (a, b) => b.fraction - a.fraction || a.key.localeCompare(b.key),
    )) {
      if (remaining-- > 0) s.quota++;
    }
    const sample = strata.flatMap((s) => s.values.slice(0, s.quota));
    // Ensure at least 50 explicit alternates while otherwise retaining proportional allocation.
    const altAvailable = pool.filter((r) => r.lineType === 'alternate');
    for (const r of altAvailable) {
      if (
        sample.filter((r) => r.lineType === 'alternate').length >= Math.min(50, altAvailable.length)
      )
        break;
      if (sample.some((x) => x.id === r.id)) continue;
      const index = sample.findIndex((x) => x.lineType !== 'alternate');
      if (index < 0) break;
      sample[index] = r;
    }
    const pilot: typeof pool = [];
    const covered = new Set<string>();
    // Small diversity pilot: 5 alternate, 5 standard; prioritize new category/game/player/side/band/score.
    for (const type of ['alternate', 'main'])
      for (let i = 0; i < 5; i++) {
        const features = (r: (typeof pool)[number]) => [
          r.category,
          r.eventId,
          r.playerId,
          r.side,
          r.oddsBand,
          r.labScore == null ? 'unknown' : r.labScore >= 70 ? 'high' : 'low',
        ];
        const candidates = sample.filter(
          (r) => r.lineType === type && !pilot.some((x) => x.id === r.id),
        );
        candidates.sort(
          (a, b) =>
            features(b).filter((x) => !covered.has(x)).length -
              features(a).filter((x) => !covered.has(x)).length ||
            hash(a.id).localeCompare(hash(b.id)),
        );
        if (candidates[0]) {
          pilot.push(candidates[0]);
          features(candidates[0]).forEach((x) => covered.add(x));
        }
      }
    const summary = {
      generatedAt: new Date().toISOString(),
      seed,
      uniqueSelections: unique.length,
      pricedOffers: offers.length,
      fanDuelSelections: fd.length,
      withoutFanDuel: without.length,
      games: events.length,
      eligiblePool: pool.length,
      categories: [...new Set(unique.map((r) => r.category))].sort().map((c) => ({
        category: c,
        total: unique.filter((r) => r.category === c).length,
        fanDuel: fd.filter((r) => r.category === c).length,
        withoutFanDuel: without.filter((r) => r.category === c).length,
      })),
      lineTypes: ['main', 'alternate', 'unknown'].map((t) => ({
        type: t,
        count: fd.filter((r) => r.lineType === t).length,
      })),
      altBands: [...new Set(fd.filter((r) => r.lineType === 'alternate').map((r) => r.oddsBand))]
        .sort()
        .map((b) => ({
          band: b,
          count: fd.filter((r) => r.lineType === 'alternate' && r.oddsBand === b).length,
        })),
      sampleSize: sample.length,
      pilotSize: pilot.length,
      sampleAlternates: sample.filter((r) => r.lineType === 'alternate').length,
      method:
        'SHA256 seeded order; proportional largest-remainder quotas across category/lineType/side/oddsBand/scoreBand; minimum 50 alternates; touchdown subtypes grouped with Other for sampling only. Pilot maximizes diversity across 5 alternate and 5 standard selections; not population-proportional.',
    };
    await writeFile(
      'reports/unabated-fanduel-audit/baseline.json',
      JSON.stringify({ summary, offers }, null, 2) + '\n',
    );
    await writeFile(
      'reports/unabated-fanduel-audit/sample.json',
      JSON.stringify({ seed, sample, pilot }, null, 2) + '\n',
    );
    console.log(JSON.stringify(summary));
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'Audit preparation failed');
  process.exitCode = 1;
});
