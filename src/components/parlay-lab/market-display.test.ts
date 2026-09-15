import assert from 'node:assert/strict';
import test from 'node:test';
import { rowName, sportsbookLineLabel } from './market-display';
import type { Market } from './ParlayLabPage';

const market = (overrides: Partial<Market>): Market => ({
  id: 'market',
  marketType: 'PASSING_TD',
  statId: 'passing_touchdowns',
  entityId: 'patrick-mahomes',
  playerId: 'patrick-mahomes',
  playerName: 'Patrick Mahomes',
  teamId: 'KC',
  period: 'game',
  side: 'OVER',
  line: 1.5,
  normalizedKey: 'passing-td',
  isAltLine: false,
  sportsbook: 'FANDUEL',
  odds: 126,
  available: true,
  deeplink: 'https://example.com',
  ...overrides,
});

test('passing touchdown totals keep the threshold in the odds box', () => {
  assert.equal(sportsbookLineLabel(market({ side: 'OVER', line: 1.5 })), 'O 1.5');
  assert.equal(sportsbookLineLabel(market({ side: 'UNDER', line: 1.5 })), 'U 1.5');
});

test('passing touchdown yes market is presented as a 1+ threshold', () => {
  const selection = market({ side: 'YES', line: null });
  assert.equal(sportsbookLineLabel(selection), '1+');
  assert.equal(rowName(selection), 'Patrick Mahomes');
});
