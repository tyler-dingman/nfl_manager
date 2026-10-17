import test from 'node:test';
import assert from 'node:assert/strict';
import { outcomeProbability, normalCdf } from './prop-probability';
import { bettingValue } from '../../../packages/parlay/betting-value';
test('normal probability matches known standard quantiles', () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6);
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-4);
});
test('count probabilities preserve push mass and complement selected sides', () => {
  const over = outcomeProbability(1, 1, 1, 'OVER', true)!;
  const under = outcomeProbability(1, 1, 1, 'UNDER', true)!;
  assert.ok(Math.abs(under.win - Math.exp(-1)) < 1e-6);
  assert.ok(Math.abs(over.push - Math.exp(-1)) < 1e-6);
  assert.ok(Math.abs(over.win + under.win + over.push - 1) < 1e-6);
  assert.equal(outcomeProbability(1, 1, 0.5, 'OVER', true)!.push, 0);
});
test('overdispersed counts differ from Poisson; invalid data is unavailable', () => {
  assert.notEqual(
    outcomeProbability(2, 6, 0.5, 'OVER', true)!.win,
    outcomeProbability(2, 2, 0.5, 'OVER', true)!.win,
  );
  assert.equal(outcomeProbability(NaN, 2, 1, 'OVER', true), null);
});
test('high hit probability can have negative EV at extreme prices', () => {
  assert.ok(bettingValue(0.88, 0, -2400).expectedReturn! < 0);
  assert.ok(bettingValue(0.78, 0, -150).expectedReturn! > 0);
  assert.equal(bettingValue(null, 0, -150).expectedReturn, null);
  assert.equal(bettingValue(0.8, 0, null).expectedReturn, null);
  assert.ok(Math.abs(bettingValue(0.4, 0.2, 100).expectedReturn!) < 1e-6);
});
