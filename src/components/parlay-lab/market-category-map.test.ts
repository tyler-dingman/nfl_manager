import assert from 'node:assert/strict';
import test from 'node:test';
import { marketPlacements } from './market-category-map';

const market = (overrides: Partial<Parameters<typeof marketPlacements>[0]> = {}) => ({
  marketType: 'PASSING_YARDS',
  statId: 'passing_yards',
  period: 'game',
  isAltLine: false,
  playerId: 'player-1',
  ...overrides,
});

test('full-game player props and alternate lines map to the approved sections', () => {
  assert.ok(
    marketPlacements(market()).some(
      (item) => item.primaryCategory === 'passing' && item.subcategory === 'Passing Yards',
    ),
  );
  assert.ok(
    marketPlacements(market({ isAltLine: true })).some(
      (item) => item.subcategory === 'Alternate Passing Yards',
    ),
  );
});

test('period markets map to period-specific navigation', () => {
  assert.deepEqual(
    marketPlacements(market({ marketType: 'SPREAD', period: '1q', playerId: null })),
    [{ primaryCategory: 'first-quarter', subcategory: '1Q Spread' }],
  );
  assert.deepEqual(
    marketPlacements(market({ marketType: 'TOTAL', period: '1h', playerId: null })),
    [{ primaryCategory: 'first-half', subcategory: '1H Total' }],
  );
  assert.deepEqual(
    marketPlacements(market({ marketType: 'RECEIVING_YARDS', period: '2q' })),
    [{ primaryCategory: 'first-half', subcategory: '2Q Receiving Yards' }],
  );
  assert.deepEqual(
    marketPlacements(market({ marketType: 'RUSHING_YARDS', period: '3q' })),
    [{ primaryCategory: 'second-half', subcategory: '3Q Rushing Yards' }],
  );
  assert.deepEqual(
    marketPlacements(market({ marketType: 'RECEPTIONS', period: '4q' })),
    [{ primaryCategory: 'second-half', subcategory: '4Q Receptions' }],
  );
});

test('defensive and kicker props map to D/ST', () => {
  assert.deepEqual(marketPlacements(market({ marketType: 'SACKS' })), [
    { primaryCategory: 'defense', subcategory: 'Sacks' },
  ]);
  assert.deepEqual(marketPlacements(market({ marketType: 'KICKING_POINTS' })), [
    { primaryCategory: 'defense', subcategory: 'Kicker Props' },
  ]);
});

test('combined rushing and receiving yards remain distinct and appear in both prop categories', () => {
  const placements = marketPlacements(
    market({ marketType: 'RECEIVING_YARDS', statId: 'rushing+receiving_yards' }),
  );
  assert.ok(
    placements.some(
      (item) =>
        item.primaryCategory === 'rushing' && item.subcategory === 'Rushing / Receiving Yards',
    ),
  );
  assert.ok(
    placements.some(
      (item) =>
        item.primaryCategory === 'receiving' && item.subcategory === 'Rushing / Receiving Yards',
    ),
  );
});
