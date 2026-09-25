import { loadEnvConfig } from '@next/env';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
async function main() {
  loadEnvConfig(process.cwd());
  const { authDb } = await import('../src/server/auth/database');
  const db = authDb();
  try {
    const baseline = JSON.parse(
      await readFile('artifacts/beat-semantic-audit/before.json', 'utf8'),
    );
    const expected = JSON.parse(await readFile('artifacts/beat-semantic-audit/after.json', 'utf8'));
    const byId = new Map<string, any>(baseline.map((s: any) => [s.id, s]));
    const decisions = new Map<string, any>(expected.map((s: any) => [s.id, s.graphicDecision]));
    const rows =
      await db`SELECT id,story_type,headline,summary,what_happened,visual_classification FROM canonical_stories`;
    for (const r of rows) {
      const old = byId.get(r.id);
      if (!old) continue;
      assert.equal(r.story_type, old.category);
      assert.equal(r.headline, old.headline);
      assert.equal(r.summary ?? '', old.summary);
      assert.equal(r.what_happened, old.whatHappened);
      assert.deepEqual(r.visual_classification, decisions.get(r.id));
    }
    const verified = rows.filter((r) => byId.has(r.id)).length;
    assert.equal(verified, baseline.length);
    const result = {
      verified,
      sourceCategoriesAndArticlesUnchanged: true,
      persistedDecisionsMatchAudit: true,
    };
    await writeFile(
      'artifacts/beat-semantic-audit/verification.json',
      JSON.stringify(result, null, 2),
    );
    console.log(result);
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
