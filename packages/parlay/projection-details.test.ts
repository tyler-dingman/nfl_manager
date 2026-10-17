import test from 'node:test';
import assert from 'node:assert/strict';
import { projectionDetails, overviewContext } from './projection-details';
import { projection } from '../../tests/mobile/fixtures/lab-score-data';
import type { ResearchDetail, HomeMarket } from './research';
test('perfect history does not become model confidence and debug text stays out', () => {
  const p = {
    ...projection,
    score: 37,
    projection: 0,
    line: 1.5,
    edge: -1.5,
    side: 'UNDER' as const,
    recommendation: 'UNDER' as const,
    role: 'QB · depth rank 2',
    rawL10: { games: 7, hits: 7, pushes: 0 },
    expectedOpportunity: { ...projection.expectedOpportunity, passingAttempts: 7.5 },
    roleAdjusted: { games: 0, hits: 0, hitRate: null, effectiveSample: 1 },
  };
  const d = projectionDetails(p, false, 'Passing TDs', 'QB');
  assert.equal(d.score, 37);
  assert.equal(d.confidence, 'LOW');
  assert.equal(d.signals[0].value, 'Backup QB');
  assert.equal(d.signals[1].value, '~7.5 attempts');
  assert.equal(d.signals[2].value, '7/7 UNDER');
  assert.doesNotMatch(JSON.stringify(d), /shadow|preview|debug|table still/i);
});
test('missing model remains unavailable and unchanged roles use a real insight', () => {
  assert.equal(projectionDetails(undefined, false, 'Receptions').score, null);
  assert.equal(
    projectionDetails(
      { ...projection, roleChange: { severity: 'NONE', direction: 'UNCERTAIN' } },
      false,
      'Receptions',
    ).material,
    false,
  );
});
test('opposing projection is disclosed without relabeling the selected-side score', () => {
  const d = projectionDetails(
    { ...projection, side: 'UNDER', recommendation: 'OVER' },
    false,
    'Rushing yards',
  );
  assert.match(d.sentence, /projection leans OVER/);
  assert.match(d.pick, /UNDER/);
});
test('right rail does not invent weather or a second matchup score', () => {
  const data = {
    market: { opponentId: 'NYJ' },
    summary: { last10: { games: 7, hits: 7 } },
    usage: { last5: 3, primaryMetric: 'Attempts' },
    lineMargin: { averageMargin: 1.5 },
    environment: { currentGame: { dayNight: 'DAY', restDays: null } },
    venue: { current: { roofType: 'UNKNOWN' } },
    gameScript: null,
  } as unknown as ResearchDetail;
  const c = overviewContext(data, { side: 'UNDER' } as HomeMarket);
  assert.equal(c.matchup.length, 0);
  assert.deepEqual(c.environment, [['Kickoff', 'Day game']]);
  assert.doesNotMatch(JSON.stringify(c), /weather|wind|pace|Lab Score/);
});
