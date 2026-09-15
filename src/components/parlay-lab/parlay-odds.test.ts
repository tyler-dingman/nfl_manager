import assert from 'node:assert/strict';
import test from 'node:test';
import { americanToDecimal, estimateParlayOdds } from './parlay-odds';

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
