import assert from 'node:assert/strict';
import test from 'node:test';
import { trendingResearchLine } from './trending-props-service';

test('anytime touchdown yes/no markets use a research threshold of 0.5', () => {
  assert.equal(
    trendingResearchLine({ marketType: 'TOUCHDOWNS', statId: 'touchdowns', line: null }),
    0.5,
  );
});

test('non-touchdown markets still require a provider line', () => {
  assert.equal(
    trendingResearchLine({ marketType: 'RECEIVING_YARDS', statId: 'receivingYards', line: null }),
    null,
  );
  assert.equal(
    trendingResearchLine({ marketType: 'PASSING_YARDS', statId: 'passingYards', line: 249.5 }),
    249.5,
  );
});
