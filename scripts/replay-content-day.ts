import { replayMaintenance } from './content-maintenance-replay';
import { build } from 'esbuild';
import { harness } from '../workers/content-engine/test/harness';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const batched = process.env.DD_BATCHED_POLLING === 'true';
const out =
  process.env.DD_DAY_REPORT_DIR ??
  (batched ? 'reports/batched-polling-capacity' : 'reports/content-engine-capacity');
async function main() {
  if (process.env.DATABASE_URL) throw Error('Replay requires DATABASE_URL absent');
  await mkdir(out, { recursive: true });
  const baseline = process.env.DD_DAY_BASELINE === 'true',
    old = resolve(`packages/storage/.content-day-baseline-${process.pid}.ts`);
  const baselineFiles = {
    retention: resolve(`packages/storage/.content-day-retention-${process.pid}.ts`),
    export: resolve(`scripts/.content-day-export-${process.pid}.mjs`),
  };
  const originals = [
    [old, 'packages/storage/editorial-ingestion.ts'],
    [baselineFiles.retention, 'packages/storage/approved-retention.ts'],
    [baselineFiles.export, 'scripts/export-no-billing.mjs'],
  ];
  let h: any;
  try {
    if (baseline)
      for (const [target, source] of originals)
        await writeFile(target, execFileSync('git', ['show', `eb8af327:${source}`]), {
          flag: 'wx',
        });
    const bundled = await build({
      entryPoints: ['workers/content-engine/test/content-day-worker.ts'],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'node',
      target: 'es2022',
      external: ['node:*'],
      tsconfig: 'tsconfig.test.json',
      plugins: [
        {
          name: 'worker-password',
          setup(b) {
            b.onResolve({ filter: /argon-node$/ }, () => ({
              path: resolve('src/server/auth/argon-worker.ts'),
            }));
          },
        },
        ...(baseline
          ? [
              {
                name: 'baseline-editorial',
                setup(b) {
                  b.onResolve({ filter: /editorial-ingestion(?:\.ts)?$/ }, () => ({ path: old }));
                },
              },
            ]
          : []),
      ],
      define: { __dirname: JSON.stringify('/') },
      banner: {
        js: "import {createRequire} from 'node:module';const require=createRequire('/worker.js');",
      },
      alias: { '@opentelemetry/api': 'next/dist/compiled/@opentelemetry/api' },
      logLevel: 'silent',
    });
    h = await harness(false, true, 999, bundled.outputFiles[0].text, false, ['nodejs_compat']);
    const day = Date.parse('2026-10-19T00:00:00Z');
    let clock = day;
    const samples: any[] = [];
    let sourceChecks = 0;
    async function rpc(op: string, data: any = {}, subsystem = op) {
      const response = await h.mf.dispatchFetch('http://localhost/fixture', {
        method: 'POST',
        headers: {
          authorization: 'Bearer synthetic-content-day-only-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ op, now: clock, enforceBudget: batched, ...data }),
      });
      const x = (await response.json()) as any;
      samples.push({ op, subsystem, ...x.metrics, wallMs: x.wallMs });
      if (!response.ok) throw Error(JSON.stringify({ op, ...x }));
      return x.result;
    }
    const registry = await rpc('registry'),
      active = registry.filter((x: any) => x.enabled);
    console.log(
      JSON.stringify({ baseline, batched, totalSources: registry.length, active: active.length }),
    );
    if (process.env.DD_REGISTRY_PREFLIGHT === 'true') {
      for (let cursor = 0; cursor < registry.length; cursor++)
        await rpc('registry-http', { cursor }, 'registry-owner-http');
      const state = await rpc('inspect');
      if (state.sourceCheckpoints.length !== 97)
        throw Error('Registry enabled source count mismatch');
      const summary = {
        sources: registry.length,
        enabled: active.length,
        maximumQueries: Math.max(...samples.map((x) => x.statements)),
        samples,
      };
      if (summary.maximumQueries > 50) throw Error('Registry exceeded query bound');
      await writeFile(out + '/registry-http.json', JSON.stringify(summary, null, 2) + '\n');
      return;
    }
    for (const x of registry) await rpc('sync', { id: x.id }, 'registry');
    for (const age of [6, 8]) {
      clock = day - age * 86400000;
      await rpc(
        'seed-retention',
        { id: active[0].id, candidate: 'processed-aged-' + age },
        'fixture-setup',
      );
    }
    clock = day;
    const initial = await rpc('inspect');
    const produced = new Map<string, number>();
    const lastItems = new Map<string, any>();
    const teamArticles = new Map<string, string[]>();
    // All configured sources, every configured revisit over a 24-hour virtual clock.
    for (let minute = 0; minute < 1440; minute++) {
      clock = day + minute * 60000;
      if (minute && minute % 30 === 0)
        for (const x of registry) await rpc('sync', { id: x.id }, 'registry');
      const feeds: Record<string, any> = {};
      const freshTeams: string[] = [];
      for (const x of active) {
        if ((minute * 60) % x.interval !== 0) continue;
        const team = x.teamId;
        const n = produced.get(team) ?? 0;
        const fresh = team && n < 3;
        const item = fresh
          ? {
              sourceId: x.id,
              externalId: `${team}-${n}`,
              url: `https://example.invalid/${team}/${n}`,
              title: `${team} ${['signs quarterback Jordan Example to contract', 'linebacker Alex Example injured and ruled out', 'hires defensive coordinator Morgan Example'][n]}`,
              author: 'Synthetic source',
              publishedAt: new Date(clock).toISOString(),
              updatedAt: null,
              fetchedAt: new Date(clock).toISOString(),
              rawText: `${team} original verified source evidence and attribution. `.repeat(120),
              excerpt: `${team} verified team roster analysis item ${n}`,
              categories: [],
              media: [],
            }
          : null;
        if (item) lastItems.set(x.id, item);
        const feedItem = item ?? (minute % 60 === 0 ? lastItems.get(x.id) : null);
        if (batched) {
          if (feedItem) feeds[x.id] = feedItem;
          if (fresh) {
            produced.set(team, n + 1);
            freshTeams.push(team);
          }
        } else {
          await rpc(
            'poll',
            { id: x.id, item: feedItem, duplicate: !!feedItem && !fresh },
            'source-poll-and-jobs',
          );
          if (fresh) {
            produced.set(team, n + 1);
            freshTeams.push(team);
          }
        }
      }
      if (batched) {
        let token: string | null = null;
        for (let continuation = 0; continuation < 1000; continuation++) {
          const result = await rpc('batch', { token, feeds }, 'source-poll-and-jobs');
          sourceChecks += result.checks ?? 0;
          token = result.token;
          if (result.idle) break;
        }
      }
      for (const team of freshTeams) {
        const result = await rpc('drain', { team }, 'editorial-processing');
        if (result?.storyId) {
          const ids = teamArticles.get(team) ?? [];
          if (!ids.includes(result.storyId)) ids.push(result.storyId);
          teamArticles.set(team, ids);
        }
      }
      if (batched) await rpc('drain', {}, 'scheduler-idle');
      if (minute === 720) {
        for (const [team, ids] of teamArticles)
          for (const id of ids)
            await rpc(
              'correct',
              { id, headline: `${team} verified correction ${id}` },
              'corrections',
            );
      }
      if (minute === 900) {
        for (let i = 0; i < 16; i++) {
          const rows = Array.from({ length: 2000 }, (_, j) => ({
            id: `event-${i}-market-${j}`,
            normalizedKey: `key-${j}`,
            playerId: `player-${j}`,
            sportsbook: 'synthetic-book',
            marketType: 'PASSING_YARDS',
            statId: 'passing_yards',
            period: 'game',
            lineType: 'main',
            teamId: active[i % active.length].teamId ?? 'KC',
            side: 'OVER',
            line: 200.5,
            odds: -110,
            available: true,
          }));
          await rpc(
            'odds',
            {
              id: `event-${i}`,
              input: {
                providerEventId: `provider-${i}`,
                season: 2026,
                week: 7,
                homeTeamId: active[i % active.length].teamId ?? 'KC',
                awayTeamId: 'BUF',
                kickoffAt: new Date(day + 86400000).toISOString(),
                status: 'OPEN',
              },
              rows,
            },
            'odds',
          );
          await rpc('scores', { id: `event-${i}` }, 'lab-scores');
        }
      }
      if (minute % 180 === 0) console.log('virtual hour', minute / 60, 'requests', samples.length);
    }
    clock = day + 1439 * 60000;
    const content = await rpc('inspect');
    const teams = [...new Set(active.map((x: any) => x.teamId).filter(Boolean))];
    for (const team of teams) {
      const ids = content.stories
        .filter((x: any) => x.team_id === team)
        .slice(0, 3)
        .map((x: any) => x.id);
      if (ids.length !== 3) throw Error('Briefing requires three actual stories for ' + team);
      await rpc(
        'brief-publish',
        {
          row: {
            id: `brief-${team}`,
            teamId: team,
            briefingDate: '2026-10-19',
            generatedAt: new Date(clock).toISOString(),
            publishedAt: new Date(clock).toISOString(),
            sourceWindowStart: new Date(day).toISOString(),
            sourceWindowEnd: new Date(clock).toISOString(),
            summaryVersion: 'synthetic-1',
            items: ids.map((id: string) => ({ id, title: 'Verified synthetic story ' + id })),
          },
        },
        'three-and-out',
      );
    }
    const beforeCleanup = await rpc('inspect');
    const maintenance = await replayMaintenance(
      h.binding,
      day + 86400000,
      h.directory,
      baseline ? baselineFiles : undefined,
    );
    const final = await rpc('inspect');
    const summary: any = {
      sourceChecks: batched ? sourceChecks : 18504,
      baseline,
      virtualHours: 24,
      initial,
      beforeCleanup,
      final,
      maintenance,
      requestCount: samples.length,
      maximumQueries: Math.max(...samples.map((x) => x.statements)),
      over50: samples.filter((x) => x.statements > 50).length,
      subsystems: {},
      assumptions: {
        content:
          '3 synthetic candidates/team; one correction per created story; content clustering/synthesis real deterministic code',
        sources:
          'all current registry cadence; repeated registry sync every 30 minutes; external fetch stubbed; no real upstream calls',
        odds: 'all 16 events x2000 markets on actual Monday 15UTC slot; schedule remains Mon/Wed/Sat; real computeTrendingProps, no invented scores; empty historical references are explicitly a coverage gap',
        cpu: 'unmeasured hosted CPU; wall time only',
        retention:
          'verified encrypted full export and complete restore before owner-only retention and GC; six/eight-day processed candidates exercise the seven-day boundary',
      },
    };
    for (const x of samples) {
      const v = (summary.subsystems[x.subsystem] ??= {
        requests: 0,
        statements: 0,
        rowsRead: 0,
        rowsWritten: 0,
        maxQueries: 0,
      });
      v.requests++;
      v.statements += x.statements;
      v.rowsRead += x.rowsRead;
      v.rowsWritten += x.rowsWritten;
      v.maxQueries = Math.max(v.maxQueries, x.statements);
    }
    await writeFile(
      `${out}/day-${baseline ? 'before' : 'after'}.json`,
      JSON.stringify(summary, null, 2) + '\n',
    );
    await writeFile(
      `${out}/requests-${baseline ? 'before' : 'after'}.json`,
      JSON.stringify(samples) + '\n',
    );
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await h?.close();
    if (baseline) for (const [target] of originals) await unlink(target).catch(() => {});
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
