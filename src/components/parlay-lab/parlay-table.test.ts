import assert from 'node:assert/strict';
import test from 'node:test';
import {
  americanOddsToDecimal,
  compareAmericanOdds,
  hitRateSortValue,
  matchesOddsFilter,
  parseHitRate,
  sortTableRows,
} from './parlay-table';

test('converts and orders American odds by payout', () => {
  assert.equal(americanOddsToDecimal(-200), 1.5);
  assert.equal(americanOddsToDecimal(150), 2.5);
  assert.deepEqual(
    [-1500, -200, -110, 100, 200].sort(compareAmericanOdds),
    [-1500, -200, -110, 100, 200],
  );
});

test('applies or-better, plus-money, custom, and missing odds rules', () => {
  const rows = [-1500, -250, -190, -110, 120];
  assert.deepEqual(
    rows.filter((value) => matchesOddsFilter(value, '-200')),
    [-190, -110, 120],
  );
  assert.deepEqual(
    rows.filter((value) => matchesOddsFilter(value, 'PLUS')),
    [120],
  );
  assert.deepEqual(
    rows.filter((value) => matchesOddsFilter(value, 'CUSTOM', -200, 150)),
    [-190, -110, 120],
  );
  assert.equal(matchesOddsFilter(null, 'ALL'), true);
  assert.equal(matchesOddsFilter(null, '-200'), false);
});

test('parses hit fractions and sorts by actual rate with missing values last', () => {
  assert.deepEqual(parseHitRate('8/9'), { hits: 8, games: 9, rate: 8 / 9 });
  const rows = [{ value: 0.9 }, { value: null }, { value: 1 }, { value: 8 / 9 }, { value: 0.7 }];
  assert.deepEqual(
    sortTableRows(rows, { key: 'rate', direction: 'desc' }, { rate: (row) => row.value }).map(
      (row) => row.value,
    ),
    [1, 0.9, 8 / 9, 0.7, null],
  );
});

test('uses the larger sample to break equal hit-rate ties', () => {
  assert.ok(hitRateSortValue(10, 10) > hitRateSortValue(2, 2));
});
