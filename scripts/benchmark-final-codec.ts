import { sealDirectory } from '../packages/storage/backup-codec';
import { writeFile } from 'node:fs/promises';
async function main() {
  const cases: [string, unknown][] = [
    [
      'unicode-5000',
      Array.from({ length: 5000 }, (_, i) => ({
        id: 'original-' + i,
        text: 'Original 🏈 content '.repeat(30),
        team: i % 2 ? 'KC' : 'SEA',
      })),
    ],
    ['entropy-60000', { data: Array.from(crypto.getRandomValues(new Uint8Array(60000))) }],
    ['tiny', { id: 'unchanged' }],
  ];
  const rows = [];
  for (const [name, value] of cases) {
    const old = await sealDirectory(value, 'synthetic-checkpoint-key-at-least-32-characters');
    const compact = await sealDirectory(
      value,
      'synthetic-checkpoint-key-at-least-32-characters',
      'binary-v2',
    );
    const before = Buffer.byteLength(JSON.stringify(old)),
      after = Buffer.byteLength(JSON.stringify(compact));
    rows.push({
      name,
      beforeEnvelopeBytes: before,
      afterEnvelopeBytes: after,
      savingPercent: (100 * (before - after)) / before,
    });
  }
  await writeFile(
    'reports/final-staging/codec-sizes.json',
    JSON.stringify(
      {
        measurement: 'serialized encrypted envelope bytes; not whole R2 bucket savings',
        defaultWriter: 'legacy',
        rows,
      },
      null,
      2,
    ),
  );
  console.log(rows);
}
main();
