/** Local synthetic schedule qualification: actual HTTP route and bounded runner. */
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { multiHarness } from '../workers/content-engine/test/multi-harness';
import { runContentContinuations } from '../workers/content-scheduler/src/continuations.mjs';
import { maintainMultiD1 } from './maintain-multi-d1';
import { readFile } from 'node:fs/promises';
import { TEAM_GROUPS } from '../packages/storage/multi-d1';
import { EDITORIAL_OWNERS } from '../packages/storage/editorial-directory';
async function main() {
  if (process.env.DATABASE_URL) throw Error('DATABASE_URL must be absent');
  const wallStart = performance.now();
  const out = 'reports/rc2/combined-day';
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
    samples.push({ op, ...x.metrics, wallMs: x.wallMs });
    return x.result;
  }
  try {
    const registry = await rpc('registry');
    for (const s of registry) await rpc('sync', { id: s.id });
    const teams = TEAM_GROUPS.flat();
    for (let i = 0; i < 50; i++)
      await rpc('seed-user', { i, team: teams[i % 32], owner: 'D1_USERS' });
    const feeds: Record<string, any> = {};
    for (const team of teams) {
      const source = registry.find((x: any) => x.enabled && x.teamId === team && x.feedUrl);
      if (!source) throw Error('Missing synthetic RSS source for ' + team);
      const items = Array.from(
        { length: 3 },
        (_, i) =>
          `<item><guid>${team}-${i}</guid><link>https://example.invalid/${team}/${i}</link><title>${team} ${['signs quarterback Jordan Example to contract', 'linebacker Alex Example injured and ruled out', 'hires defensive coordinator Morgan Example'][i]}</title><pubDate>Mon, 19 Oct 2026 00:00:00 GMT</pubDate><description><![CDATA[${(team + ' original verified source evidence and attribution. ').repeat(120)}]]></description></item>`,
      ).join('');
      feeds[source.feedUrl] = {
        xml:
          '<?xml version="1.0"?><rss version="2.0"><channel><title>Synthetic</title>' +
          items +
          '</channel></rss>',
        etag: '"rc2-' + team + '"',
      };
    }
    await rpc('fixture-rss', { feeds });
    const minutes = Number(process.env.DD_SCHEDULER_MINUTES ?? 1440);
    let capped = 0;
    for (let minute = 0; minute < minutes; minute++) {
      clock = Date.parse('2026-10-19T00:00:00Z') + minute * 60000;
      const result = await runContentContinuations(
        (q) => rpc('automation-http', { query: q.toString() }),
        32,
      );
      if (!result.complete) capped++;
      // Registry refreshes retain existing cadence and are distinct bounded requests.
      if (minute && minute % 30 === 0)
        for (const source of registry) await rpc('sync', { id: source.id });
      // Corrections are actual atomic publications, paced one per minute.
      if (minute >= 720 && minute < 816) {
        const index = minute - 720,
          team = teams[Math.floor(index / 3)];
        const state = await rpc('inspect', { team });
        const story = state.stories.filter((x: any) => x.team_id === team)[index % 3];
        if (story)
          await rpc('correct', {
            id: story.id,
            team,
            headline: team + ' verified correction ' + index,
          });
      }
      if (minute >= 900 && minute < 916) {
        const i = minute - 900;
        const rows = Array.from({ length: 2000 }, (_, j) => ({
          id: `event-${i}-market-${j}`,
          normalizedKey: `key-${j}`,
          playerId: `player-${j}`,
          sportsbook: 'synthetic-book',
          marketType: 'PASSING_YARDS',
          statId: 'passing_yards',
          period: 'game',
          lineType: 'main',
          teamId: teams[i],
          side: 'OVER',
          line: 200.5,
          odds: -110,
          available: true,
        }));
        await rpc('odds', {
          id: `event-${i}`,
          input: {
            providerEventId: `provider-${i}`,
            season: 2026,
            week: 7,
            homeTeamId: teams[i],
            awayTeamId: 'BUF',
            kickoffAt: new Date(clock + 86400000).toISOString(),
            status: 'OPEN',
          },
          rows,
        });
        await rpc('scores', { id: `event-${i}` });
      }
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
    const states = [];
    for (const owner of EDITORIAL_OWNERS) states.push(await rpc('inspect', { owner }));
    const stories = states.flatMap((x: any) => x.stories);
    // Separate bounded briefing publications; this does not qualify live push/email.
    for (const team of teams) {
      const ids = stories
        .filter((x: any) => x.team_id === team)
        .slice(0, 3)
        .map((x: any) => x.id);
      if (ids.length !== 3) continue;
      await rpc('brief-publish', {
        team,
        row: {
          id: 'rc2-brief-' + team,
          teamId: team,
          briefingDate: '2026-10-19',
          generatedAt: new Date(clock).toISOString(),
          publishedAt: new Date(clock).toISOString(),
          sourceWindowStart: '2026-10-19T00:00:00Z',
          sourceWindowEnd: new Date(clock).toISOString(),
          summaryVersion: 'rc2-synthetic',
          items: ids.map((id: string) => ({ id, title: 'Verified ' + id })),
        },
      });
    }
    const maintenance = await maintainMultiD1(
      h.db,
      'synthetic-rc2-offline-backup-key-at-least-32-characters',
      {
        rawWritersStopped: true,
        now: clock,
        persistAndReadBack: async (archive) => {
          const path = out + '/encrypted-backup.json';
          await writeFile(path, JSON.stringify(archive), { mode: 0o600 });
          return { path, archive: JSON.parse(await readFile(path, 'utf8')) };
        },
      },
    );
    const measured = samples.filter((s) => !['seed-user', 'fixture-rss'].includes(s.op));
    const subsystems = Object.fromEntries(
      [...new Set(measured.map((s) => s.op))].map((op) => {
        const xs = measured.filter((s) => s.op === op);
        return [
          op,
          {
            requests: xs.length,
            rowsRead: xs.reduce((n, s) => n + s.rowsRead, 0),
            rowsWritten: xs.reduce((n, s) => n + s.rowsWritten, 0),
            maxQueries: Math.max(...xs.map((s) => s.statements)),
          },
        ];
      }),
    );
    const maximum = Math.max(...samples.map((s) => s.statements));
    const report = {
      scope:
        'MEASURED local workerd actual automation route + 32-call scheduler, 32 RSS XML feeds with 96 arrivals, 50 followers, paced corrections, synthetic odds/scoring, briefing publications, stopped-writer offline retention. No live provider, push/email delivery, HTTP user activity or hosted CPU.',
      minutes,
      wallTimeMs: performance.now() - wallStart,
      publishedStories: stories.length,
      pendingJobs: states
        .flatMap((x: any) => x.jobs)
        .filter((x: any) => !['DONE', 'COMPLETED'].includes(x.status)),
      pendingInbox: states.flatMap((x: any) => x.pendingInbox),
      maintenance,
      activeSources: active.length,
      expectedChecks: expected,
      actualChecks: actual,
      checksPreserved: actual === expected,
      cappedTicks: capped,
      maximumQueries: maximum,
      requests: measured.length,
      rowsRead: measured.reduce((n, s) => n + s.rowsRead, 0),
      rowsWritten: measured.reduce((n, s) => n + s.rowsWritten, 0),
      checkpoints,
      subsystems,
      failedSourceCheckpoints: states
        .flatMap((x: any) => x.sourceCheckpoints)
        .filter((x: any) => x.failure_count > 0),
      maintenanceOperationsMeasured: false,
      hostedCpuMeasured: false,
    };
    await writeFile(out + '/combined-schedule.json', JSON.stringify(report, null, 2) + '\n');
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
