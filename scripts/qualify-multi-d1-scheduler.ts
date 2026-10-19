/** Local synthetic schedule qualification: actual HTTP route and bounded runner. */
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { multiHarness } from '../workers/content-engine/test/multi-harness';
import { runContentContinuations } from '../workers/content-scheduler/src/continuations.mjs';
import { EDITORIAL_OWNERS } from '../packages/storage/editorial-directory';
async function main() {
  const out = 'reports/release-candidate/scheduler';
  await mkdir(out, { recursive: true });
  const bundle = await build({
    entryPoints: ['workers/content-engine/test/content-day-worker.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    external: ['node:*'],
    tsconfig: 'tsconfig.test.json',
    define: { __dirname: JSON.stringify('/') },
    banner: {
      js: "import {createRequire} from 'node:module';const require=createRequire('/worker.js');",
    },
    alias: { '@opentelemetry/api': 'next/dist/compiled/@opentelemetry/api' },
    plugins: [
      {
        name: 'worker-password',
        setup(b) {
          b.onResolve({ filter: /argon-node$/ }, () => ({
            path: resolve('src/server/auth/argon-worker.ts'),
          }));
        },
      },
    ],
    logLevel: 'silent',
  });
  const h = await multiHarness(true, bundle.outputFiles[0].text);
  let clock = Date.parse('2026-10-19T00:00:00Z');
  const samples: any[] = [];
  async function rpc(op: string, data: any = {}) {
    const response = await h.mf.dispatchFetch('http://localhost/fixture', {
      method: 'POST',
      headers: {
        authorization: 'Bearer synthetic-content-day-only-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ op, now: clock, enforceBudget: true, ...data }),
    });
    const x: any = await response.json();
    if (!response.ok) throw Error(JSON.stringify(x));
    samples.push({ op, ...x.metrics });
    return x.result;
  }
  try {
    const registry = await rpc('registry');
    for (const s of registry) await rpc('sync', { id: s.id });
    const minutes = Number(process.env.DD_SCHEDULER_MINUTES ?? 1440);
    let capped = 0;
    for (let minute = 0; minute < minutes; minute++) {
      clock = Date.parse('2026-10-19T00:00:00Z') + minute * 60000;
      const result = await runContentContinuations(
        (q) => rpc('automation-http', { query: q.toString() }),
        32,
      );
      if (!result.complete) capped++;
      if (minute % 120 === 0) console.log(JSON.stringify({ minute, capped }));
    }
    const checkpoints = [];
    for (const owner of EDITORIAL_OWNERS)
      checkpoints.push(
        ...(await h.db[owner]
          .prepare(
            'SELECT id,request_count,last_checked_at,next_check_at FROM app_editorial_sources WHERE enabled=1',
          )
          .all()
          .then((r) => r.results)),
      );
    const active = registry.filter((s: any) => s.enabled),
      expected = active.reduce(
        (n: number, s: any) => n + Math.ceil((minutes * 60) / s.interval),
        0,
      ),
      actual = checkpoints.reduce((n: number, s: any) => n + s.request_count, 0);
    const maximum = Math.max(...samples.map((s) => s.statements));
    const report = {
      scope:
        'MEASURED local workerd actual automation HTTP route, 32-call scheduler, synthetic unchanged RSS; no editorial arrivals or provider network; not hosted CPU',
      minutes,
      activeSources: active.length,
      expectedChecks: expected,
      actualChecks: actual,
      checksPreserved: actual === expected,
      cappedTicks: capped,
      maximumQueries: maximum,
      requests: samples.length,
      rowsRead: samples.reduce((n, s) => n + s.rowsRead, 0),
      rowsWritten: samples.reduce((n, s) => n + s.rowsWritten, 0),
      checkpoints,
    };
    await writeFile(out + '/bounded-schedule.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
    if (maximum > 50) throw Error('Query limit exceeded');
  } finally {
    await h.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
