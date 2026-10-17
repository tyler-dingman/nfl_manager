import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayLabScore } from './lab-score-config';
import { bettingOpportunityRank, isTrendingEligible } from './trending-selection';

test('display lift preserves missing evidence and caps the scale', () => {
  assert.equal(displayLabScore(71), 76);
  assert.equal(displayLabScore(97), 99);
  assert.equal(displayLabScore(0), 0);
  assert.equal(displayLabScore(71, false), 0);
  assert.equal(displayLabScore(NaN), 0);
  for (let score = 1; score < 99; score++) {
    assert(displayLabScore(score + 1) >= displayLabScore(score));
  }
});
test('display lift does not alter betting rank or discovery eligibility', () => {
  const original = {
    side: 'OVER',
    odds: -110,
    trend: {
      trendScore: 58,
      projection: {
        projection: 100,
        recommendation: 'OVER',
        estimatedProbability: 0.7,
        pushProbability: 0,
        dataQuality: { reliability: 0.9, freshness: 1, currentRoleKnown: true },
      },
    },
  };
  const displayed = {
    ...original,
    trend: {
      ...original.trend,
      trendScore: displayLabScore(58),
      projection: { ...original.trend.projection, modelScore: 58 },
    },
  };
  assert.equal(bettingOpportunityRank(displayed), bettingOpportunityRank(original));
  assert.equal(isTrendingEligible(displayed), isTrendingEligible(original));
  assert.equal(isTrendingEligible(displayed), false);
});
