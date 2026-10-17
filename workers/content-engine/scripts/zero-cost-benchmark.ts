import { writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { harness } from '../test/harness';
import {
  LeanEditorial,
  LeanR2Objects,
  type Strategy,
  type EditorialDocument,
} from '../src/lean-editorial';
import { candidate, source, story, video, NOW } from '../test/fixtures';
import { TEAM_IDS } from '../src/teams';
function rawText(seed: number, entropy: boolean) {
  let state = seed + 1,
    out = '';
  while (out.length < 8192) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    out += entropy
      ? state.toString(36)
      : ['team ', 'quarterback ', 'injury ', 'practice ', 'coach ', 'source '][state % 6];
  }
  return out.slice(0, 8192);
}
const output: any = {
  scope:
    'Six local whole-day synthetic architecture measurements. Existing freshness/counts preserved. No public API cutover, model execution, notifications, production traffic or live Worker CPU. Tables include all migration root pages, no VACUUM.',
  results: {},
};
const selectedStrategy = process.argv.find((arg) => arg.startsWith('--strategy='))?.split('=')[1];
if (selectedStrategy && !['A', 'B', 'C'].includes(selectedStrategy))
  throw Error('Invalid benchmark strategy');
for (const strategy of (selectedStrategy ? [selectedStrategy] : ['A', 'B', 'C']) as Strategy[])
  for (const mode of ['standard', 'entropy']) {
    const h = await harness(true);
    try {
      const objects = new LeanR2Objects(
          (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as R2Bucket,
        ),
        store = new LeanEditorial(h.db, objects, strategy);
      const audit = async () => {
        const dir = join(h.directory, 'd1', 'miniflare-D1DatabaseObject');
        for (const file of await readdir(dir))
          if (file.endsWith('.sqlite') && !file.includes('metadata')) {
            const a = JSON.parse(
              execFileSync('python3', ['scripts/sqlite-pages.py', join(dir, file)], {
                encoding: 'utf8',
              }),
            );
            if (a.objects.some((o: any) => o.name === 'lean_heads')) return a;
          }
        throw Error('Missing fixture database');
      };
      const before = await audit(),
        cpu = process.cpuUsage(),
        wall = performance.now(),
        start = h.db.measurements.length;
      const put = async (
        kind: string,
        id: string,
        payload: unknown,
        teamIds: string[] = [],
        headline = '',
        category = '',
        sourceId: string | null = null,
      ) =>
        store.put({ kind, id, payload, teamIds, headline, category, sourceId, publishedAt: NOW });
      for (const t of TEAM_IDS) await put('source', `src-${t}`, source(`src-${t}`, t), [t]);
      await put('source', 'source-1', source('source-1', null), [...TEAM_IDS]);
      for (let i = 0; i < 200; i++) {
        const team = TEAM_IDS[i % 32],
          c = {
            ...candidate(`candidate-${i}`, 'source-1', team),
            rawText: rawText(i, mode === 'entropy'),
          };
        await put('candidate', c.id, c, [team], c.title, 'candidate', 'source-1');
        if (i % 10 === 0)
          await put(
            'candidate',
            c.id,
            {
              ...c,
              fingerprint: `corrected-${i}`,
              rawText: c.rawText + ' Original correction preserved.',
            },
            [team],
            c.title,
            'candidate',
            'source-1',
          );
      }
      for (let i = 0; i < 83; i++) {
        const id = `story-${i}`,
          team = TEAM_IDS[i % 32],
          s = story(id, i < 80 ? team : null);
        await put('story', id, s, i < 80 ? [team] : [...TEAM_IDS], s.headline, 'NEWS', 'source-1');
        await put(
          'evidence',
          `evidence-${i}`,
          {
            id: `evidence-${i}`,
            storyId: id,
            candidateId: `candidate-${i}`,
            candidateRevision: 1,
            sourceId: 'source-1',
            firstSeenAt: NOW,
          },
          [],
          '',
          '',
          'source-1',
        );
        await put(
          'story',
          id,
          { ...s, version: 2, publicationState: 'PUBLISHED' },
          i < 80 ? [team] : [...TEAM_IDS],
          s.headline,
          'NEWS',
          'source-1',
        );
      }
      for (let i = 0; i < 40; i++) {
        const v = video(`video-${i}`, [TEAM_IDS[i % 32], TEAM_IDS[(i + 1) % 32]]);
        await put(
          'video',
          v.videoId,
          { ...v, description: rawText(1000 + i, mode === 'entropy').slice(0, 1000) },
          v.teamIds,
          v.title,
          'VIDEO',
          'source-1',
        );
      }
      for (const [i, t] of TEAM_IDS.entries())
        await put(
          'edition',
          `edition-${t}`,
          {
            id: `edition-${t}`,
            teamId: t,
            briefingDate: '2026-10-16',
            status: 'PUBLISHED',
            generatedAt: NOW,
            items: [0, 1, 2].map((x) => ({
              storyId: `story-${80 + x}`,
              summary: rawText(3000 + i * 3 + x, mode === 'entropy').slice(0, 3300),
            })),
          },
          [t],
          'Three & Out',
          'BRIEFING',
          'source-1',
        );
      for (let i = 0; i < 1400; i++)
        await store.receipt('job', `job-${i}`, `once-${i}`, {
          id: `job-${i}`,
          status: 'DONE',
          attempts: 1,
          sourceId: `src-${TEAM_IDS[i % 32]}`,
          retained: 'Exact historical job metadata. '.repeat(8),
        });
      for (let i = 0; i < 1040; i++)
        await store.receipt('check', `check-${i}`, `check-${i}`, {
          id: `check-${i}`,
          sourceId: `src-${TEAM_IDS[i % 32]}`,
          attemptedAt: NOW + i,
          successful: i % 20 !== 0,
          nextCheckAt: NOW + 3600000,
          etag: `etag-${i}`,
          cursor: { lastId: i },
        });
      for (let i = 0; i < 115; i++)
        await store.receipt('outbox', `event-${i}`, `event-${i}`, {
          id: `event-${i}`,
          acknowledgedAt: NOW + 1,
          aggregateId: `story-${i % 83}`,
          version: 2,
        });
      for (let i = 0; i < 32; i++)
        await store.receipt('run', `run-${i}`, `run-${i}`, {
          id: `run-${i}`,
          kind: 'SYNTHETIC',
          metrics: { retained: 'Synthetic execution metrics. '.repeat(10) },
        });
      const meters = h.db.measurements.slice(start),
        usage = process.cpuUsage(cpu),
        after = await audit();
      const repeatStart = h.db.measurements.length,
        r2before = objects.writes;
      await put(
        'story',
        'story-0',
        { ...story('story-0', TEAM_IDS[0]), version: 2, publicationState: 'PUBLISHED' },
        [TEAM_IDS[0]],
        'Synthetic story-0',
        'NEWS',
        'source-1',
      );
      const duplicate = {
        rowsWritten: h.db.measurements.slice(repeatStart).reduce((n, m) => n + m.rowsWritten, 0),
        r2Writes: objects.writes - r2before,
      };
      if (duplicate.rowsWritten || duplicate.r2Writes)
        throw Error('Duplicate ingestion wrote data');
      const performanceResults: any = {};
      for (const [name, fn] of [
        ['article', () => store.get('story', 'story-0')],
        ['home', () => store.feed('ari', 'story')],
        ['team', () => store.feed('kc', 'story')],
        ['historical', () => store.get('candidate', 'candidate-0', 1)],
        [
          'search',
          () =>
            strategy === 'C'
              ? Promise.resolve('UNSUPPORTED historical index')
              : store.history('source-1'),
        ],
      ] as const) {
        const times = [];
        const m = h.db.measurements.length,
          get = objects.reads;
        for (let n = 0; n < 10; n++) {
          const t = performance.now();
          await fn();
          times.push(performance.now() - t);
        }
        times.sort((a, b) => a - b);
        performanceResults[name] = {
          medianMs: (times[4] + times[5]) / 2,
          maxMs: times[9],
          rowsRead: h.db.measurements.slice(m).reduce((n, x) => n + x.rowsRead, 0),
          objectReads: objects.reads - get,
          samples: 10,
        };
      }
      let retirement: any = null;
      if (strategy === 'B') {
        const m = h.db.measurements.length,
          reads = objects.reads,
          t = performance.now();
        let retired = 0,
          n = 0;
        do {
          n = await store.retireHot(NOW + 1);
          retired += n;
        } while (n);
        retirement = {
          retired,
          rowsRead: h.db.measurements.slice(m).reduce((n, x) => n + x.rowsRead, 0),
          rowsWritten: h.db.measurements.slice(m).reduce((n, x) => n + x.rowsWritten, 0),
          r2Reads: objects.reads - reads,
          wallMs: performance.now() - t,
          after: await audit(),
        };
        if (!(await store.get('candidate', 'candidate-0', 1))) throw Error('Lost cold history');
      }
      const key = `${strategy}-${mode}`;
      output.results[key] = {
        before,
        after,
        ownedGrowthBytes: after.ownedBytes - before.ownedBytes,
        rowsRead: meters.reduce((n, x) => n + x.rowsRead, 0),
        rowsWritten: meters.reduce((n, x) => n + x.rowsWritten, 0),
        statements: meters.reduce((n, x) => n + x.statements, 0),
        objectWrites: objects.writes,
        objectBytes: objects.bytesWritten,
        objectReads: objects.reads,
        wallMs: performance.now() - wall,
        hostCpuMs: (usage.user + usage.system) / 1000,
        duplicate,
        performance: performanceResults,
        retirement,
      };
      console.log(
        key,
        JSON.stringify({
          ownedGrowthBytes: output.results[key].ownedGrowthBytes,
          rowsWritten: output.results[key].rowsWritten,
          r2Bytes: objects.bytesWritten,
        }),
      );
      await writeFile(
        selectedStrategy
          ? `measurements/zero-cost-${selectedStrategy}-benchmark.json`
          : 'measurements/zero-cost-benchmark.json',
        JSON.stringify(output, null, 2) + '\n',
      );
    } finally {
      await h.close();
    }
  }
