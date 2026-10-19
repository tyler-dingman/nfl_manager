import { PollingBatches } from '../../../packages/storage/polling-batches';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { harness } from '../test/harness';
import { Storage } from '../../../packages/storage/core';
import { D1Objects } from '../../../packages/storage/d1-objects';
import { D1EditorialIngestion } from '../../../packages/storage/editorial-ingestion';
const out = new URL('../../../reports/multi-d1-staging/', import.meta.url);
test(
  'measure current four-version canonical storage with shared and changing original correction bodies',
  { timeout: 120000 },
  async () => {
    const results = [];
    for (const changed of [false, true]) {
      const h = await harness(false, true, 999, undefined, false);
      try {
        const s = new Storage(h.binding, new D1Objects(h.binding)),
          r = new D1EditorialIngestion(s);
        const source: any = {
          id: 'original-source',
          name: 'Original attribution',
          sourceType: 'OFFICIAL_TEAM',
          teamId: 'KC',
          leagueWide: false,
          url: 'https://example.invalid',
          feedUrl: 'https://example.invalid/rss',
          fetchStrategy: 'RSS',
          pollingTier: 'A',
          priority: 100,
          reliabilityScore: 1,
          checkIntervalSeconds: 300,
          enabled: true,
          etag: null,
          lastModified: null,
          lastCheckedAt: null,
          lastSuccessfulAt: null,
          nextCheckAt: new Date(0),
          failureCount: 0,
          lastError: null,
          metadata: {},
        };
        await r.syncSource(source);
        const candidate: any = {
          id: 'original-candidate',
          sourceId: source.id,
          externalId: 'original-item',
          url: 'https://example.invalid/original',
          title: 'Original report',
          normalizedTitle: 'original report',
          author: 'Original publisher',
          publishedAt: new Date().toISOString(),
          discoveredAt: new Date().toISOString(),
          text: 'Original source evidence',
          excerpt: 'Original evidence',
          entities: [],
          candidateTeams: ['KC'],
          fingerprint: 'original',
          status: 'NEW',
          storyType: 'ANALYSIS',
        };
        await r.saveCandidate(candidate);
        const prose = () => randomBytes(9000).toString('base64');
        const first = prose(),
          originals: any[] = [];
        const synth: any = {
          headline: 'Original report',
          summary: 'Original summary',
          whatHappened: first,
          whyItMatters: 'Original context',
          whatsNext: 'Original next',
          status: 'DEVELOPING',
          importanceScore: 80,
          confidenceScore: 95,
          claims: [],
        };
        const id = await r.createStory(candidate, source, synth, 'PUBLISHED', 'NEW_FACT');
        originals.push(await r.storyById(id));
        for (let version = 2; version <= 4; version++) {
          await r.promoteExistingStory(
            originals.at(-1),
            {
              ...synth,
              headline: 'Correction ' + version,
              whatHappened: changed ? prose() : first,
            },
            {
              action: 'AUTO_PUBLISH',
              reason: 'Verified original correction',
              confidence: 95,
              breaking: false,
            },
          );
          originals.push(await r.storyById(id));
        }
        const roots = await s.rows<any>(
          'SELECT object_hash FROM app_editorial_stories UNION SELECT object_hash FROM app_editorial_versions',
        );
        const reachable = new Set<string>();
        async function visit(hash: string) {
          if (reachable.has(hash)) return;
          reachable.add(hash);
          const value = await s.get<any>(hash);
          const walk = async (x: any): Promise<void> => {
            if (!x || typeof x !== 'object') return;
            for (const [key, v] of Object.entries(x)) {
              if (key === 'bodyHash' && typeof v === 'string') await visit(v);
              else if (v && typeof v === 'object') await walk(v);
            }
          };
          await walk(value);
        }
        for (const row of roots) await visit(row.object_hash);
        let encoded = 0;
        for (const hash of reachable) {
          const [row] = await s.rows<any>('SELECT bytes FROM app_payload_objects WHERE hash=?', [
            hash,
          ]);
          assert.ok(row);
          encoded += row.bytes;
        }
        for (let version = 1; version <= 4; version++) {
          const revision = await r.revisionByVersion(id, version);
          assert.deepEqual(revision.story, originals[version - 1]);
        }
        assert.equal((await r.evidenceForStory(id))[0].candidate.author, 'Original publisher');
        assert.equal((await s.rows('PRAGMA foreign_key_check')).length, 0);
        const batch = new PollingBatches(s),
          lease = (await batch.claim())!;
        let quotaFailure = true;
        const quotaDb: any = {
          prepare: (sql: string) => h.binding.prepare(sql),
          batch: async (statements: any[]) => {
            if (quotaFailure) {
              quotaFailure = false;
              throw Error('D1_ERROR: daily quota exceeded');
            }
            return h.binding.batch(statements);
          },
        };
        const quotaStorage = new Storage(quotaDb, new D1Objects(quotaDb));
        const empty = {
          async fetch() {
            return { items: [], notModified: true, etag: 'verified', lastModified: null };
          },
        };
        await assert.rejects(
          new PollingBatches(quotaStorage).step(lease.token, empty),
          /daily quota exceeded/,
        );
        assert.equal(
          (await s.rows<any>('SELECT request_count FROM app_editorial_sources'))[0].request_count,
          0,
        );
        assert.equal((await s.rows('SELECT id FROM app_storage_poll_batch')).length, 1);
        await new PollingBatches(quotaStorage).step(lease.token, empty);
        assert.equal(
          (await s.rows<any>('SELECT request_count FROM app_editorial_sources'))[0].request_count,
          1,
        );
        results.push({
          scenario: changed ? 'four-independent-bodies' : 'shared-unchanged-body',
          versions: 4,
          proseRawBytesPerVersion: 12000,
          canonicalEncodedBytesPerArticle: encoded,
          canonicalObjects: reachable.size,
          allRevisionsVerified: true,
          scope:
            'Actual current D1 canonical commit and readback; independent high-entropy synthetic corrections, not observed seasonal traffic',
        });
      } finally {
        await h.close();
      }
    }
    assert.ok(
      results[1].canonicalEncodedBytesPerArticle > results[0].canonicalEncodedBytesPerArticle,
    );
    await mkdir(out, { recursive: true });
    await writeFile(
      new URL('canonical-sizes.json', out),
      JSON.stringify({ results }, null, 2) + '\n',
    );
  },
);
