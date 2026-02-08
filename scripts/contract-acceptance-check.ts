import { strict as assert } from 'node:assert';

import { computeGuaranteeScore, getGuaranteeBandForRating } from '../src/lib/contract-acceptance';
import { evaluateContractOffer } from '../src/lib/contract-negotiation';

const nearlyEqual = (actual: number, expected: number, tolerance = 0.03) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual.toFixed(3)} to be within ${tolerance} of ${expected.toFixed(3)}`,
  );
};

const { threshold: eliteThreshold } = getGuaranteeBandForRating(97);
assert.equal(eliteThreshold, 0.5, 'Elite threshold should be 0.50');

const guaranteeAtThreshold = computeGuaranteeScore(0.5, 97);
nearlyEqual(guaranteeAtThreshold, 0.7, 0.02);

const guaranteeAboveThreshold = computeGuaranteeScore(0.6, 87);
assert.ok(guaranteeAboveThreshold > 0.7, 'Guarantee score should rise above threshold.');

const offerOne = evaluateContractOffer({
  marketApy: 57,
  offeredApy: 55,
  years: 5,
  guaranteed: 137.5,
  position: 'QB',
  rating: 97,
  maxYears: 5,
});
nearlyEqual(offerOne.probability, 0.7, 0.04);

const offerTwo = evaluateContractOffer({
  marketApy: 57,
  offeredApy: 60,
  years: 5,
  guaranteed: 120,
  position: 'QB',
  rating: 97,
  maxYears: 5,
});
nearlyEqual(offerTwo.probability, 0.75, 0.04);

console.log('Contract acceptance checks passed.');
