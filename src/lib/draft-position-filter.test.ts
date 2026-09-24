import test from 'node:test';
import assert from 'node:assert/strict';
import { draftPositionFilter, matchesDraftPosition } from './draft-position-filter';
test('need links normalize positions and safely ignore invalid filters', () => {
  for (const position of ['OT', 'DL', 'IOL', 'EDGE', 'WR', 'CB', 'TE'])
    assert.equal(draftPositionFilter(position), position);
  assert.equal(draftPositionFilter(' ot '), 'OT');
  assert.equal(draftPositionFilter(null), 'ALL');
  assert.equal(draftPositionFilter('invalid'), 'ALL');
});
test('grouped needs include position aliases but exclude other groups', () => {
  for (const [position, filter] of [
    ['LT', 'OT'],
    ['RT', 'OT'],
    ['DT', 'DL'],
    ['NT', 'DL'],
    ['OG', 'IOL'],
    ['C', 'IOL'],
    ['DE', 'EDGE'],
    ['CB/WR', 'WR'],
  ])
    assert(matchesDraftPosition(position, filter));
  assert(!matchesDraftPosition('OT', 'DL'));
  assert(!matchesDraftPosition('EDGE', 'DL'));
  assert(!matchesDraftPosition(null, 'OT'));
  assert(matchesDraftPosition(null, 'ALL'));
});
