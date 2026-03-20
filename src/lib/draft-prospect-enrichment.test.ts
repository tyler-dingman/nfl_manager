import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generateDraftProspectSummary,
  getProjectedRangeFromRanking,
  inferDraftProspectArchetype,
} from '@/lib/draft-prospect-enrichment';

test('maps projected ranges from ranking tiers', () => {
  assert.equal(getProjectedRangeFromRanking(4), 'Top 10');
  assert.equal(getProjectedRangeFromRanking(28), 'Round 1');
  assert.equal(getProjectedRangeFromRanking(44), 'Round 1-2');
  assert.equal(getProjectedRangeFromRanking(150), 'Day 3');
});

test('infers quarterback archetypes with rushing production', () => {
  assert.equal(
    inferDraftProspectArchetype({
      position: 'QB',
      stats: { rushYards: 540, passingTD: 27 },
    }),
    'Dual-Threat QB',
  );
});

test('generates summary even with sparse profile data', () => {
  const summary = generateDraftProspectSummary({
    name: 'Test Prospect',
    ranking: 87,
    school: null,
    position: 'EDGE',
    classYear: null,
    height: null,
    weight: null,
    stats: {},
    archetype: null,
  });

  assert.match(summary, /prospect/i);
  assert.ok(summary.length > 40);
});
