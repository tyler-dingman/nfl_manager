import test from 'node:test';
import assert from 'node:assert/strict';

import { getPlayerTradeValue } from '@/lib/trade-player-valuation';
import type { TradePlayerInput } from '@/types/trade-offers';

const makePlayer = (overrides: Partial<TradePlayerInput> = {}): TradePlayerInput => ({
  id: 'player-1',
  firstName: 'Test',
  lastName: 'Player',
  teamAbbr: 'KC',
  position: 'WR',
  age: 26,
  rating: 80,
  maddenRating: 82,
  baselineRating: 76,
  capHit: '$8.0M',
  capHitValue: 8,
  salary: 8,
  averagePerYear: 8,
  contractYearsRemaining: 2,
  contract: {
    yearsRemaining: 2,
    apy: 8,
    guaranteed: 12,
    capHit: 8,
    expiresAfterSeason: false,
  },
  stats: {
    receptions: 72,
    recYards: 980,
    recTD: 7,
  },
  ...overrides,
});

test('player trade value rises materially with rating', () => {
  const mid = getPlayerTradeValue(makePlayer({ rating: 76, maddenRating: 78 })).value;
  const elite = getPlayerTradeValue(makePlayer({ rating: 90, maddenRating: 92 })).value;
  assert.ok(elite > mid * 1.7);
});

test('younger premium player can outvalue older expensive veteran', () => {
  const olderVet = getPlayerTradeValue(
    makePlayer({
      position: 'LB',
      age: 31,
      rating: 84,
      averagePerYear: 18,
      capHitValue: 18,
      capHit: '$18.0M',
      contractYearsRemaining: 1,
    }),
  ).value;
  const youngTackle = getPlayerTradeValue(
    makePlayer({
      position: 'LT',
      age: 24,
      rating: 78,
      maddenRating: 80,
      averagePerYear: 3,
      capHitValue: 3,
      capHit: '$3.0M',
      contractYearsRemaining: 3,
    }),
  ).value;
  assert.ok(youngTackle > olderVet);
});

test('bad expensive contracts are penalized', () => {
  const fairDeal = getPlayerTradeValue(
    makePlayer({ averagePerYear: 8, capHitValue: 8, capHit: '$8.0M' }),
  ).value;
  const expensiveDeal = getPlayerTradeValue(
    makePlayer({ averagePerYear: 18, capHitValue: 18, capHit: '$18.0M' }),
  ).value;
  assert.ok(fairDeal > expensiveDeal);
});
