import { loadEnvConfig } from '@next/env';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

async function main() {
  loadEnvConfig(process.cwd());
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')),
  );
  const season = Number(args.season ?? new Date().getUTCFullYear());
  if (!Number.isInteger(season) || season < 2021 || season > 2100)
    throw new Error('Use --season=YYYY (2021 or later)');
  const { authDb } = await import('../src/server/auth/database');
  const db = authDb();
  try {
    if ('migrate' in args) {
      const connection = await db.reserve();
      try {
        await connection.unsafe(await readFile('db/migrations/042_canonical_schedule.sql', 'utf8'));
      } finally {
        connection.release();
      }
    }
    const { ingestSchedule } = await import('../src/server/schedule/ingest');
    console.log(await ingestSchedule(season, 'dry-run' in args));
    if ('backfill' in args && !('dry-run' in args)) {
      const { enrichGameStories } = await import('../src/server/schedule/enrich');
      const rows =
        await db`SELECT id,team_id,story_type,headline,summary,what_happened,first_reported_at,last_meaningful_update_at FROM canonical_stories WHERE first_reported_at>=${`${season}-03-01`}::timestamptz AND first_reported_at<${`${season + 1}-03-01`}::timestamptz ORDER BY id`;
      const results = [];
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100).map((r) => ({
          id: r.id,
          teamAbbr: r.team_id ?? 'NFL',
          category: r.story_type,
          headline: r.headline,
          summary: r.summary,
          whatHappened: r.what_happened,
          publishedAt: r.first_reported_at.toISOString(),
          updatedAt: r.last_meaningful_update_at.toISOString(),
        }));
        results.push(...(await enrichGameStories(batch)));
      }
      await mkdir('artifacts/beat-schedule-audit', { recursive: true });
      await writeFile(
        `artifacts/beat-schedule-audit/${season}.json`,
        JSON.stringify(
          results.map((r) => ({
            id: r.id,
            headline: r.headline,
            team: r.teamAbbr,
            publication: r.publishedAt,
            resolution: r.gameResolution,
            game: r.game,
            graphic: r.graphicDecision.graphic,
          })),
          null,
          2,
        ),
      );
      console.log({ stories: results.length, resolved: results.filter((r) => r.gameId).length });
    }
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
