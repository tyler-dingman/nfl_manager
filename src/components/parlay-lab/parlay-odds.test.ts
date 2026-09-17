import assert from 'node:assert/strict';
import test from 'node:test';
import {
  americanToDecimal,
  estimateParlayOdds,
  hypotheticalPortfolioResult,
  hypotheticalReturn,
} from './parlay-odds';

test('converts American prices to decimal prices', () => {
  assert.equal(americanToDecimal(100), 2);
  assert.equal(americanToDecimal(-200), 1.5);
});

test('estimates a parlay by multiplying independent decimal prices', () => {
  assert.equal(estimateParlayOdds([-113, -113]), 255);
});

test('does not estimate a book missing any selected leg price', () => {
  assert.equal(estimateParlayOdds([-113, null]), null);
});

test('calculates a hypothetical total return including the stake', () => {
  assert.equal(hypotheticalReturn(253, 10), 35.3);
  assert.equal(hypotheticalReturn(-200, 10), 15);
});

test('calculates all-time hypothetical net winnings from settled saved parlays', () => {
  assert.deepEqual(
    hypotheticalPortfolioResult([
      { status: 'HIT', odds: 200 },
      { status: 'MISSED', odds: 150 },
      { status: 'VOID', odds: -110 },
      { status: 'UPCOMING', odds: 300 },
      { status: 'HIT', odds: 250, hasVoidLeg: true },
    ]),
    { count: 3, staked: 30, totalReturn: 40, net: 10 },
  );
});
