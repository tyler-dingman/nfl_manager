import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPickAsset,
  getFuturePickTradeValue,
  getPickTradeValue,
  sumPickPackageValue,
} from '@/lib/trade-chart';

test('draft pick chart returns higher values for earlier picks', () => {
  assert.ok(
    getPickTradeValue({ round: 1, overallSlot: 1 }) >
      getPickTradeValue({ round: 1, overallSlot: 32 }),
  );
  assert.ok(
    getPickTradeValue({ round: 2, overallSlot: 33 }) >
      getPickTradeValue({ round: 5, overallSlot: 150 }),
  );
});

test('future pick discount lowers value against current-year pick', () => {
  const currentFirst = getPickTradeValue({ round: 1, overallSlot: 20 });
  const futureFirst = getFuturePickTradeValue({ year: 2027, round: 1, projectedRound: 1 }, 1, 1);
  assert.ok(futureFirst < currentFirst);
});

test('pick package values sum correctly', () => {
  const total = sumPickPackageValue([
    { year: 2026, round: 2, overallSlot: 48 },
    { year: 2026, round: 4, overallSlot: 116 },
  ]);
  const expected =
    getPickTradeValue({ round: 2, overallSlot: 48 }) +
    getPickTradeValue({ round: 4, overallSlot: 116 });
  assert.equal(total, Number(expected.toFixed(1)));
});

test('buildPickAsset returns projected trade points and metadata', () => {
  const asset = buildPickAsset({ year: 2026, round: 1, overallSlot: 18, owningTeamAbbr: 'KC' });
  assert.equal(asset.type, 'pick');
  assert.equal(asset.owningTeamAbbr, 'KC');
  assert.equal(asset.round, 1);
  assert.ok(asset.projectedValuePoints > 0);
});
