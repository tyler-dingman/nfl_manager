import assert from 'node:assert/strict';
import test from 'node:test';
import { trendingResearchLine, supportsFullGameResearch } from './trending-props-service';

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

test('full-game research excludes quarter, half and unknown periods regardless of line size', () => {
  assert.equal(supportsFullGameResearch('game'), true);
  for (const period of ['1q', '2q', '3q', '4q', '1h', '2h', undefined, null, '']) {
    assert.equal(supportsFullGameResearch(period), false);
  }
});
