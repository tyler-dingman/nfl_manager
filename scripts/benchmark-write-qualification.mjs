// Baseline modules live beside their originals to preserve relative imports.
// Only synthetic local D1 is opened. No application files are overwritten.
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
const files = [
  ['editorial-ingestion.ts', '.qualification-baseline-editorial.ts'],
  ['parlay-scores.ts', '.qualification-baseline-props.ts'],
];
try {
  for (const [source, target] of files)
    await writeFile(
      `packages/storage/${target}`,
      execFileSync('git', ['show', `db07ea56:packages/storage/${source}`]),
      { flag: 'wx' },
    );
  for (const baseline of ['true', 'false']) {
    const env = {
      ...process.env,
      DD_WRITE_BASELINE: baseline,
      DATABASE_URL: undefined,
      AUTH_JWT_SECRET: 'synthetic-worker-test-key-at-least-32-characters',
      TSX_TSCONFIG_PATH: '../../tsconfig.test.json',
    };
    delete env.DATABASE_URL;
    const r = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--test', 'test-node/write-qualification.test.ts'],
      { cwd: 'workers/content-engine', env, encoding: 'utf8' },
    );
    process.stdout.write(r.stdout + r.stderr);
    if (r.status !== 0) throw Error('Write qualification failed');
  }
} finally {
  for (const [, target] of files) await unlink(`packages/storage/${target}`).catch(() => {});
}
