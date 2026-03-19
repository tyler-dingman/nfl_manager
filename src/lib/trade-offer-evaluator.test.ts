import test from 'node:test';
import assert from 'node:assert/strict';

import { bandFromScore, evaluateTradeForTeam } from '@/lib/trade-offer-evaluator';
import type { TradeAssetPackage, TradeEvaluationContext, TradeTeamProfile } from '@/types/trade-offers';

const context: TradeEvaluationContext = {
  teamAbbr: 'KC',
  phase: 'manage',
  contenderWindow: 'win_now',
  needs: ['OT', 'CB', 'WR'],
  capSpace: 15,
};

const profile: TradeTeamProfile = {
  teamAbbr: 'KC',
  aggressive: 0.6,
  conservative: 0.3,
  winNow: 0.8,
  rebuilding: 0.2,
  capSensitive: 0.3,
  needDriven: 0.7,
  prefersPicks: 0.25,
  prefersVeterans: 0.7,
  futurePickTolerance: 0.55,
  overpayForStars: 0.62,
};

const makePackage = (value: number, position = 'OT'): TradeAssetPackage => ({
  totalValue: value,
  assets: [
    {
      id: `asset-${value}`,
      type: 'player',
      playerId: `p-${value}`,
      teamAbbr: 'SEA',
      name: 'Asset',
      position,
      age: 27,
      rating: 82,
      capHit: '$8.0M',
      contractSummary: '2 yr · $8.0M',
      projectedValuePoints: value,
    },
  ],
});

test('fairness bands map to expected ranges', () => {
  assert.equal(bandFromScore(0.7), 'reject');
  assert.equal(bandFromScore(0.9), 'low_interest');
  assert.equal(bandFromScore(1.0), 'fair');
  assert.equal(bandFromScore(1.14), 'high_interest');
  assert.equal(bandFromScore(1.3), 'smash_accept');
});

test('teams prefer offers that match needs', () => {
  const needMatch = evaluateTradeForTeam(makePackage(100, 'OT'), makePackage(100, 'LB'), context, profile);
  const offNeed = evaluateTradeForTeam(makePackage(100, 'RB'), makePackage(100, 'LB'), context, profile);
  assert.ok(needMatch.score > offNeed.score);
});
