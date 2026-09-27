import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BEAT_PRIMARY,
  BEAT_SECONDARY,
  activeFilterCount,
  filterLabel,
  filterValue,
  resetFilters,
} from './index';

test('web and native share all categories, sorting, and time options', () => {
  assert.deepEqual(
    BEAT_PRIMARY[0].options.map((o) => o.value),
    ['ALL', 'HOT', 'ROSTER', 'INJURIES', 'DRAFT', 'GAMES'],
  );
  assert.equal(filterLabel(BEAT_PRIMARY[1], {}), 'Recently updated');
  assert.equal(filterValue(BEAT_PRIMARY[0], { type: 'INVALID' }), 'ALL');
});
test('secondary counts exclude primary selections and reset preserves them', () => {
  const values = { type: 'INJURIES', sort: 'NEWEST', range: 'TODAY' };
  assert.equal(activeFilterCount(BEAT_SECONDARY, values), 1);
  assert.deepEqual(
    { ...values, ...resetFilters(BEAT_SECONDARY) },
    { type: 'INJURIES', sort: 'NEWEST', range: 'ALL' },
  );
  assert.equal(activeFilterCount(BEAT_SECONDARY, resetFilters(BEAT_SECONDARY)), 0);
});
