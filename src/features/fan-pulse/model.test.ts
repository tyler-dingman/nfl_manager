import assert from 'node:assert/strict';
import test from 'node:test';

import { dominantFanPulse, fanPulsePercentages, fanPulseSummary } from './model';

test('percentages derive from counts and resolve to 100', () => {
  const percentages = fanPulsePercentages({
    FIRED_UP: 5,
    LIKE_IT: 3,
    NOT_SURE: 1,
    DONT_LOVE_IT: 1,
    NO_WAY: 1,
  });
  assert.equal(
    Object.values(percentages).reduce((sum, value) => sum + value, 0),
    100,
  );
  assert.equal(percentages.FIRED_UP, 46);
});

test('dominant reaction and summary use actual leading count', () => {
  const counts = { FIRED_UP: 2, LIKE_IT: 6, NOT_SURE: 1, DONT_LOVE_IT: 0, NO_WAY: 0 };
  assert.equal(dominantFanPulse(counts), 'LIKE_IT');
  assert.match(fanPulseSummary('Bills', counts), /^67% of Bills fans like this news\.$/);
});
