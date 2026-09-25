import { loadEnvConfig } from '@next/env';
import { writeFile } from 'node:fs/promises';
async function main() {
  loadEnvConfig(process.cwd());
  const { authDb } = await import('../src/server/auth/database');
  const { enrichGameStories } = await import('../src/server/schedule/enrich');
  const db = authDb();
  try {
    const rows =
      await db`SELECT id,team_id,story_type,headline,summary,what_happened,last_meaningful_update_at,first_reported_at FROM canonical_stories ORDER BY team_id,id`;
    const stories = rows.map((r) => ({
      id: r.id,
      teamAbbr: r.team_id ?? 'NFL',
      category: r.story_type,
      headline: r.headline,
      summary: r.summary ?? '',
      whatHappened: r.what_happened,
      updatedAt: r.last_meaningful_update_at.toISOString(),
      publishedAt: r.first_reported_at.toISOString(),
    }));
    const enriched = await enrichGameStories(stories, false);
    await writeFile('artifacts/beat-semantic-audit/before.json', JSON.stringify(enriched, null, 2));
    console.log({ stories: enriched.length, teams: new Set(enriched.map((s) => s.teamAbbr)).size });
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
