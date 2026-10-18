import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../test/harness';
import { Storage, type SqlDatabase } from '../../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../../packages/storage/objects';
import { ReferenceData } from '../../../packages/storage/reference';
import { withApplicationBindings } from '../../../src/server/persistence/bindings';
import { answerD1Search, d1AnswerDependencies } from '../../../src/server/search/d1-answer';
test('D1 structured search uses stored schedule attribution, reports missing evidence, and fails closed on malformed hosted classification', async () => {
  const h = await harness();
  try {
    const objects = new PrivateObjects(
        (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket,
      ),
      db = h.binding as unknown as SqlDatabase,
      s = new Storage(db, objects);
    const year = new Date().getUTCFullYear();
    await new ReferenceData(s).put('SCHEDULE', `original-season-${year}`, 'NFL', year, [
      {
        id: 'original-game-id',
        providerEventId: '401234567',
        season: year,
        week: 19,
        homeTeam: 'KC',
        awayTeam: 'DEN',
        kickoffAt: `${year}-12-31T21:00:00Z`,
        kickoffConfirmed: true,
        status: 'SCHEDULED',
      },
    ]);
    await withApplicationBindings(
      { db, objects, env: { APP_DATA_BACKEND: 'd1', DATABASE_URL: '' } },
      async () => {
        const deps = d1AnswerDependencies(),
          schedule = await deps.loadSchedule('KC', new Date(`${year}-10-18T12:00:00Z`));
        assert.equal(schedule[0].id, '401234567');
        assert(schedule[0].source.url.includes('401234567'));
        assert.equal(await deps.classify!('nonsense'), null);
        await assert.rejects(deps.loadInjuries('KC', new Date()));
        const result = await answerD1Search({
          query: 'When do the Chiefs play next?',
          teamId: 'KC',
        });
        assert(result.sources.some((source) => source.url.includes('401234567')));
      },
    );
    await withApplicationBindings(
      {
        db,
        objects,
        ai: { run: async () => ({ response: 'not valid JSON' }) },
        env: { APP_DATA_BACKEND: 'd1', SEARCH_ANSWER_PROVIDER: 'workers-ai' },
      },
      async () => {
        assert.equal(await d1AnswerDependencies().classify!('ambiguous question'), null);
      },
    );
  } finally {
    await h.close();
  }
});
