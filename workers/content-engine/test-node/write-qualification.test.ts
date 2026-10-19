import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { harness } from '../test/harness';
import { D1OddsBoard } from '../../../packages/storage/odds-board';
import { Storage, type SqlDatabase } from '../../../packages/storage/core';
import { D1Objects } from '../../../packages/storage/d1-objects';
import { D1EditorialIngestion as CurrentEditorial } from '../../../packages/storage/editorial-ingestion';
import { PrecomputedProps as CurrentProps } from '../../../packages/storage/parlay-scores';
const baseline = process.env.DD_WRITE_BASELINE === 'true';
const oldEditorial = '../../../packages/storage/.qualification-baseline-editorial.ts';
const oldProps = '../../../packages/storage/.qualification-baseline-props.ts';
const D1EditorialIngestion = baseline
  ? (await import(oldEditorial)).D1EditorialIngestion
  : CurrentEditorial;
const PrecomputedProps = baseline ? (await import(oldProps)).PrecomputedProps : CurrentProps;

test(
  'no-R2 workerd retries skip candidate uploads and score rewrites without hiding changes',
  { timeout: 60000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false);
    const samples: any[] = [];
    let calls: any[] = [];
    const raw = h.binding as unknown as SqlDatabase;
    const wrap = (st: any, sql: string): any => ({
      bind: (...v: any[]) => wrap(st.bind(...v), sql),
      all: async () => {
        const r = await st.all();
        calls.push({ sql, ...r.meta });
        return r;
      },
      run: async () => {
        const r = await st.run();
        calls.push({ sql, ...r.meta });
        return r;
      },
      first: async () => {
        const r = await st.all();
        calls.push({ sql, ...r.meta });
        return r.results[0] ?? null;
      },
      _st: st,
      _sql: sql,
    });
    const db: any = {
      prepare: (sql: string) => wrap(raw.prepare(sql), sql),
      batch: async (st: any[]) => {
        const rs = await raw.batch(st.map((s) => s._st));
        rs.forEach((r, i) => calls.push({ sql: st[i]._sql, ...r.meta }));
        return rs;
      },
    };
    const measure = async (name: string, fn: () => Promise<any>) => {
      calls = [];
      const value = await fn();
      samples.push({
        name,
        statements: calls.length,
        rowsRead: calls.reduce((a, x) => a + (x.rows_read ?? 0), 0),
        rowsWritten: calls.reduce((a, x) => a + (x.rows_written ?? 0), 0),
        calls: calls.slice(),
      });
      return value;
    };
    const storage = () => new Storage(db, new D1Objects(db));
    try {
      const s = storage(),
        r = new D1EditorialIngestion(s);
      await r.syncSource({
        id: 'src',
        name: 'Source',
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
        nextCheckAt: new Date(),
        failureCount: 0,
        lastError: null,
        metadata: {},
      } as any);
      const candidate: any = {
        id: 'original',
        sourceId: 'src',
        externalId: 'external',
        url: 'https://example.invalid/story',
        title: 'Original',
        normalizedTitle: 'original',
        author: 'Source',
        publishedAt: new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
        text: 'Evidence',
        excerpt: 'Evidence',
        entities: [],
        candidateTeams: ['KC'],
        fingerprint: 'fingerprint',
        status: 'NEW',
        storyType: 'NEWS',
      };
      const beforeObjects = (await s.rows<any>('SELECT count(*) n FROM app_payload_objects'))[0].n;
      await measure('candidate-first', () => r.saveCandidate(candidate));
      await measure('candidate-retry-new-random-id', () =>
        new D1EditorialIngestion(storage()).saveCandidate({
          ...candidate,
          id: undefined,
          discoveredAt: new Date().toISOString(),
        }),
      );
      if (!baseline) assert.equal(samples.at(-1).rowsWritten, 0);
      await measure('candidate-status-first', () =>
        r.setCandidateStatus('original', 'PROCESSED', 'complete'),
      );
      await measure('candidate-status-retry', () =>
        new D1EditorialIngestion(storage()).setCandidateStatus('original', 'PROCESSED', 'complete'),
      );
      // Fencing guards can still write even when UPDATE changes zero rows.
      assert.equal((await r.candidateById('original'))?.status, 'PROCESSED');
      if (!baseline)
        assert.equal(
          (await s.rows<any>('SELECT count(*) n FROM app_payload_objects'))[0].n,
          beforeObjects + 1,
        );
      const sourceRecord = await r.sourceById('src');
      const synth: any = {
        headline: 'Original article',
        summary: 'Original summary',
        whatHappened: 'Source evidence',
        whyItMatters: 'Context',
        whatsNext: 'Next steps',
        status: 'DEVELOPING',
        importanceScore: 80,
        confidenceScore: 95,
        claims: [{ text: 'Claim', sourceEvidenceIds: ['original'], confidence: 95 }],
      };
      const article = await measure('article-first-published', () =>
        r.createStory(candidate, sourceRecord!, synth, 'PUBLISHED', 'NEW_FACT'),
      );
      const original = await r.storyById(article);
      await measure('article-correction', () =>
        r.promoteExistingStory(
          original!,
          { ...synth, headline: 'Verified correction' },
          { action: 'AUTO_PUBLISH', reason: 'Correction', confidence: 95, breaking: false },
        ),
      );
      await measure('source-check-success', () =>
        r.markSourceSuccess(sourceRecord!, null, null, new Date(Date.now() + 300000), 100),
      );
      await measure('job-enqueue', () =>
        r.enqueueJob('SOURCE_FETCH', 'qualified-job', { sourceId: 'src' }),
      );
      const odds = new D1OddsBoard(storage()),
        input: any = {
          providerEventId: 'profile-odds',
          season: 2026,
          week: 1,
          homeTeamId: 'KC',
          awayTeamId: 'BUF',
          kickoffAt: new Date(Date.now() + 86400000),
          status: 'OPEN',
        };
      const market: any = {
        id: 'profile-market',
        normalizedKey: 'profile-key',
        playerId: 'player',
        sportsbook: 'book',
        marketType: 'PASS_YARDS',
        side: 'OVER',
        line: 42.5,
        odds: -110,
        available: true,
      };
      await measure('odds-first', () => odds.publish(input, [market], 123456, 'profile-event'));
      await measure('odds-identical-observation-retry', () =>
        new D1OddsBoard(storage()).publish(input, [market], 123456, 'profile-event'),
      );
      await measure('odds-new-timestamp-unchanged-price', () =>
        new D1OddsBoard(storage()).publish(input, [market], 123457, 'profile-event'),
      );
      const board = await s.put({ schema: 1, board: 'synthetic' });
      await raw
        .prepare(
          "INSERT INTO app_sportsbook_events(id,provider_event_id,season,week,home_team_id,away_team_id,kickoff_at,status,last_imported_at,markets_hash,as_of) VALUES('event','provider',2026,1,'KC','BUF',0,'OPEN',0,?,0)",
        )
        .bind(board)
        .run();
      const source = { board, references: 0 },
        args: any[] = [
          { id: 'market', playerId: 'player', sportsbook: 'book', line: 42.5, odds: -110 },
        ];
      const hash = await measure('scores-first', () =>
        new PrecomputedProps(storage()).publish(
          'event',
          'model',
          {},
          2026,
          undefined,
          source,
          args,
        ),
      );
      const stamp = (await s.rows<any>('SELECT computed_at FROM app_parlay_scores'))[0].computed_at;
      assert.equal(
        await measure('scores-identical-retry', () =>
          new PrecomputedProps(storage()).publish(
            'event',
            'model',
            {},
            2026,
            undefined,
            source,
            args,
          ),
        ),
        hash,
      );
      if (!baseline) assert.equal(samples.at(-1).rowsWritten, 0);
      if (!baseline)
        assert.equal(
          (await s.rows<any>('SELECT computed_at FROM app_parlay_scores'))[0].computed_at,
          stamp,
        );
      const changed = await measure('scores-changed', () =>
        new PrecomputedProps(storage()).publish('event', 'model', {}, 2026, undefined, source, [
          { ...args[0], odds: 120 },
        ]),
      );
      assert.notEqual(changed, hash);
      await raw
        .prepare('UPDATE app_sportsbook_events SET markets_hash=?')
        .bind('changed-source')
        .run();
      await assert.rejects(
        new PrecomputedProps(storage()).publish(
          'event',
          'model',
          {},
          2026,
          undefined,
          source,
          args,
        ),
        /sources changed/,
      );
      assert.equal((await s.rows('PRAGMA foreign_key_check')).length, 0);
      await mkdir('../../reports/multi-d1-qualification', { recursive: true });
      await writeFile(
        `../../reports/multi-d1-qualification/write-samples${baseline ? '-before' : ''}.json`,
        JSON.stringify(
          {
            runtime: 'local workerd D1; no R2 bindings; cold adapter caches per retry',
            scope:
              'adapter invocation, not complete HTTP; local rows_written metadata is not a production index-cost certificate',
            samples,
          },
          null,
          2,
        ) + '\n',
      );
    } finally {
      await h.close();
    }
  },
);
