import { readFile } from 'node:fs/promises';
import { loadEnvConfig } from '@next/env';
import {
  parseDepthEvidence,
  parseInjuryEvidence,
  roleObservationSchema,
} from '../src/server/historical-stats/role-ingestion';
import type { RoleObservation } from '../packages/parlay/role-evidence';

const arg = (name: string) =>
  process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
async function download(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Role feed returned ${response.status}: ${url}`);
  return response.text();
}
async function main() {
  loadEnvConfig(process.cwd());
  const { authDb } = await import('../src/server/auth/database');
  const { parseCsv } = await import('../src/server/historical-stats/importer');
  const receivedAt = new Date().toISOString();
  const file = arg('file');
  const results: {
    source: string;
    observations: RoleObservation[];
    unmapped: number;
    invalid: number;
    sourceAt: string | null;
    complete: boolean;
  }[] = [];
  if (file) {
    const payload = JSON.parse(await readFile(file, 'utf8'));
    const observations = roleObservationSchema
      .array()
      .parse(payload.observations)
      .map((o) => ({ ...o, receivedAt }));
    if (observations.some((o) => Date.parse(o.sourceAt) > Date.parse(receivedAt)))
      throw new Error('Future-dated role evidence rejected');
    results.push({
      source: 'structured-role-import',
      observations,
      unmapped: 0,
      invalid: 0,
      sourceAt:
        payload.sourceAt && Number.isFinite(Date.parse(payload.sourceAt)) ? payload.sourceAt : null,
      complete: payload.complete === true,
    });
  } else {
    const season = arg('season') ?? String(new Date().getFullYear());
    const feeds = await Promise.allSettled([
      download(
        process.env.PARLAY_DEPTH_URL ??
          `https://github.com/nflverse/nflverse-data/releases/download/depth_charts/depth_charts_${season}.csv`,
      ),
      download('https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries'),
    ]);
    for (const [index, result] of feeds.entries()) {
      if (result.status === 'rejected') {
        console.error(result.reason instanceof Error ? result.reason.message : 'Feed unavailable');
        continue;
      }
      if (index === 0) {
        const depthRows = parseCsv(result.value);
        const latestDate = depthRows
          .map((r) => r.dt)
          .filter(Boolean)
          .sort()
          .at(-1);
        const parsed = parseDepthEvidence(
          depthRows.filter((r) => r.dt === latestDate),
          receivedAt,
        );
        const latest =
          parsed.observations
            .map((o) => o.sourceAt)
            .sort()
            .at(-1) ?? null;
        // Keep every source timestamp in archived input imports; live refresh needs only latest depth.
        results.push({
          source: 'nflverse:depth',
          ...parsed,
          observations: parsed.observations.filter((o) => o.sourceAt === latest),
          sourceAt: latest,
          complete: false,
        });
      } else {
        const parsed = parseInjuryEvidence(JSON.parse(result.value), receivedAt);
        // ESPN does not attest the availability of players absent from its injury list.
        results.push({ source: 'espn:injuries', ...parsed, complete: false });
      }
    }
  }
  if (!results.length) throw new Error('No role feeds available; existing evidence will age out');
  const db = authDb();
  try {
    for (const result of results) {
      if (!process.argv.includes('--dry-run'))
        await db.begin(async (tx) => {
          for (const o of result.observations)
            await tx`INSERT INTO parlay_role_observations(player_id,team_id,source,source_at,received_at,evidence)
          VALUES(${o.playerId},${o.teamId},${o.source},${o.sourceAt},${receivedAt},${tx.json({ ...o, receivedAt: undefined })}) ON CONFLICT DO NOTHING`;
          await tx`INSERT INTO parlay_role_feed_runs(source,source_at,received_at,rows_imported,complete,diagnostics)
          VALUES(${result.source},${result.sourceAt},${receivedAt},${result.observations.length},${result.complete},${tx.json({ unmapped: result.unmapped, invalid: result.invalid, teamIds: [...new Set(result.observations.map((o) => o.teamId))] })})`;
        });
      console.log(
        JSON.stringify({
          source: result.source,
          rows: result.observations.length,
          sourceAt: result.sourceAt,
          unmapped: result.unmapped,
          invalid: result.invalid,
          complete: result.complete,
          dryRun: process.argv.includes('--dry-run'),
        }),
      );
    }
  } finally {
    await db.end();
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
