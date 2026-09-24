import { loadEnvConfig } from '@next/env';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
async function main() {
  loadEnvConfig(process.cwd());
  const { authDb } = await import('../src/server/auth/database');
  const { enrichBeatTransaction } = await import('../src/server/content/beat-transactions');
  const db = authDb();
  try {
    await db.unsafe(await readFile('db/migrations/043_beat_transaction_metadata.sql', 'utf8'));
    const rows =
      await db`SELECT id,team_id,story_type,headline,summary,what_happened,last_meaningful_update_at FROM canonical_stories ORDER BY team_id,id`;
    const audit = [];
    for (const r of rows) {
      const decision = enrichBeatTransaction({
        id: r.id,
        teamAbbr: r.team_id ?? 'NFL',
        category: r.story_type,
        headline: r.headline,
        summary: r.summary,
        whatHappened: r.what_happened,
        updatedAt: r.last_meaningful_update_at.toISOString(),
      });
      const transaction = decision.graphic.family === 'transaction' ? decision.graphic : null;
      await db`UPDATE canonical_stories SET transaction_metadata=${transaction ? db.json(transaction) : null} WHERE id=${r.id} AND transaction_metadata IS DISTINCT FROM ${transaction ? db.json(transaction) : null}::jsonb`;
      audit.push({
        id: r.id,
        team: r.team_id,
        headline: r.headline,
        summary: r.summary,
        category: r.story_type,
        decision,
      });
    }
    await mkdir('artifacts/beat-transaction-audit', { recursive: true });
    await writeFile(
      'artifacts/beat-transaction-audit/stories.json',
      JSON.stringify(audit, null, 2),
    );
    console.log({
      stories: audit.length,
      teams: new Set(audit.map((s) => s.team)).size,
      transactions: audit.filter((s) => s.decision.graphic.family === 'transaction').length,
    });
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
