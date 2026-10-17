import { execFileSync } from 'node:child_process';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { harness } from '../test/harness';
import { oddsRefreshSlot } from '../src/odds-schedule';

const results = [];
for (const summaryBytes of [200, 32000]) {
  const h = await harness(true);
  try {
    const summary = JSON.stringify('x'.repeat(summaryBytes - 2));
    let slots = 0;
    for (let day = 0; day < 365; day++) {
      const now = new Date(Date.UTC(2026, 0, 1 + day, 15));
      const slot = oddsRefreshSlot(now);
      if (!slot) continue;
      await h.db.batch('odds.fixture.year', [
        h.db.statement(
          'INSERT INTO odds_refresh_slots(slot,token,state,started_at,finished_at,summary_json) VALUES(?,?,?,?,?,?)',
          [slot, crypto.randomUUID(), 'COMPLETE', now.getTime(), now.getTime(), summary],
        ),
      ]);
      slots++;
    }
    const directory = join(h.directory, 'd1', 'miniflare-D1DatabaseObject');
    for (const file of await readdir(directory)) {
      if (!file.endsWith('.sqlite') || file.includes('metadata')) continue;
      const audit = JSON.parse(
        execFileSync('python3', ['scripts/sqlite-pages.py', join(directory, file)], {
          encoding: 'utf8',
        }),
      );
      const table = audit.objects.find((row: any) => row.name === 'odds_refresh_slots');
      if (table) results.push({ summaryBytes, slots, table });
    }
  } finally {
    await h.close();
  }
}
await writeFile(
  '../../reports/zero-cost-phase-2/schedule-storage.json',
  JSON.stringify(
    {
      scope:
        'MEASURED local SQLite allocation for one synthetic year of durable scheduling slots. Fixtures directly inserted; provider not called. Claim+completion costs two row writes per attempted slot.',
      results,
    },
    null,
    2,
  ) + '\n',
);
