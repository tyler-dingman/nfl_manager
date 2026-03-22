import test from 'node:test';
import assert from 'node:assert/strict';

import { bandFromScore, evaluateTradeForTeam } from '@/lib/trade-offer-evaluator';
import type {
  TradeAssetPackage,
  TradeEvaluationContext,
  TradeTeamProfile,
} from '@/types/trade-offers';

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

const makePlayerAsset = (
  value: number,
  rating: number,
  position = 'OT',
): TradeAssetPackage['assets'][number] => ({
  id: `player-${value}-${rating}`,
  type: 'player',
  playerId: `p-${value}-${rating}`,
  teamAbbr: 'SEA',
  name: 'Asset',
  position,
  age: 27,
  rating,
  capHit: '$8.0M',
  contractSummary: '2 yr · $8.0M',
  projectedValuePoints: value,
});

const makePickAsset = (
  value: number,
  year: number,
  round: number,
): TradeAssetPackage['assets'][number] => ({
  id: `pick-kc-${year}-r${round}-${value}`,
  type: 'pick',
  label: `${year} Round ${round}`,
  year,
  round,
  overallSlot: null,
  owningTeamAbbr: 'KC',
  originalTeamAbbr: 'KC',
  projectedRound: round,
  projectedValuePoints: value,
  futureDiscount: year > 2026 ? 0.72 : 1,
});

test('fairness bands map to expected ranges', () => {
  assert.equal(bandFromScore(0.7), 'reject');
  assert.equal(bandFromScore(0.9), 'low_interest');
  assert.equal(bandFromScore(1.0), 'fair');
  assert.equal(bandFromScore(1.14), 'high_interest');
  assert.equal(bandFromScore(1.3), 'smash_accept');
});

test('teams prefer offers that match needs', () => {
  const needMatch = evaluateTradeForTeam(
    makePackage(100, 'OT'),
    makePackage(100, 'LB'),
    context,
    profile,
  );
  const offNeed = evaluateTradeForTeam(
    makePackage(100, 'RB'),
    makePackage(100, 'LB'),
    context,
    profile,
  );
  assert.ok(needMatch.score > offNeed.score);
});

test('junk bundles do not buy star players easily', () => {
  const incoming: TradeAssetPackage = {
    totalValue: 36,
    assets: [makePickAsset(12, 2026, 6), makePickAsset(11, 2026, 7), makePickAsset(13, 2027, 6)],
  };
  const outgoing: TradeAssetPackage = {
    totalValue: 640,
    assets: [makePlayerAsset(640, 91, 'LB')],
  };
  const result = evaluateTradeForTeam(incoming, outgoing, context, profile);
  assert.ok(result.score < 0.82);
});

test('premium player plus a second keeps elite trade discussions plausible', () => {
  const incoming: TradeAssetPackage = {
    totalValue: 1220,
    assets: [makePlayerAsset(860, 90, 'WR'), makePickAsset(360, 2026, 2)],
  };
  const outgoing: TradeAssetPackage = {
    totalValue: 1180,
    assets: [makePlayerAsset(1180, 94, 'WR')],
  };
  const result = evaluateTradeForTeam(incoming, outgoing, context, profile);
  assert.ok(result.score >= 0.82);
  assert.ok(result.score < 1.21);
});
