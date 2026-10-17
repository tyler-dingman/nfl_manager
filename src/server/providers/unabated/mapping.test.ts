import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUnabatedProps } from './normalize';
import { verifyGeneratedFanDuelSlip } from './generated-slip';
import type { ShadowSelection } from './coverage';
import type { SlipLeg } from '../../../../packages/parlay/slip';
const row: ShadowSelection = {
  eventId: 1,
  eventName: 'CHI @ GB',
  eventStart: '2030-01-01T00:00:00Z',
  leagueId: 1,
  periodTypeId: 1,
  betTypeId: 999,
  betSubType: '',
  personId: 7,
  teamId: 8,
  sideIndex: 0,
  sideName: 'Over',
  marketId: 10,
  marketLineId: 11,
  marketSourceId: 2,
  points: 224.5,
  price: 108,
  lineType: 'main',
  available: true,
  deepLink: 'https://www.gambly.com/deeplink/odds/2/11/224.5',
  sportsbookMarketId: '42.123',
  sportsbookSelectionId: '456',
  modifiedOn: '2029-12-31T00:00:00Z',
  freshnessExpiresAt: '2030-01-01T00:00:00Z',
};
// Synthetic IDs exist only in this isolated fixture, never in a production market map.
const maps = {
  events: new Map([[1, { id: 'existing-event', kickoffAt: row.eventStart! }]]),
  players: new Map([[7, { id: 'existing-player', teamId: 'CHI' }]]),
  periods: new Map([[1, 'game']]),
  markets: new Map([
    [
      999,
      {
        marketType: 'PASSING_YARDS' as const,
        statId: 'passing_yards',
        name: 'Passing Yards',
        sides: { 0: 'OVER', 1: 'UNDER' },
      },
    ],
  ]),
  sources: new Map([[2, 'FANDUEL' as const]]),
};
test('normalization preserves canonical IDs, exact alternate lines and compact book identifiers', () => {
  const alt = {
    ...row,
    points: 199.5,
    price: -1000,
    lineType: 'alternate' as const,
    deepLink: null,
    sportsbookMarketId: null,
    sportsbookSelectionId: null,
  };
  const result = normalizeUnabatedProps([row, row, alt, { ...row, sideIndex: 1 }], maps);
  assert.equal(result.markets.length, 3);
  assert.equal(result.rejected.length, 0);
  const standard = result.markets[0];
  assert.equal(standard.eventId, 'existing-event');
  assert.equal(standard.playerId, 'existing-player');
  assert.equal(standard.prices.length, 1);
  assert.equal(standard.prices[0].providerMarketLineId, '11');
  assert.equal(standard.prices[0].sportsbookSelectionId, '456');
  assert.equal(standard.prices[0].providerDeepLink, row.deepLink);
  assert.equal(result.markets[1].line, 199.5);
  assert.equal(result.markets[1].prices[0].odds, -1000);
  assert.equal(result.markets[1].prices[0].sportsbookSelectionId, null);
  assert.equal(result.markets[2].side, 'UNDER');
});
test('unknown mappings, mismatched events and unordered conflicting offers fail closed', () => {
  assert.equal(normalizeUnabatedProps([{ ...row, betTypeId: 123 }], maps).markets.length, 0);
  assert.equal(
    normalizeUnabatedProps([{ ...row, eventStart: '2031-01-01T00:00:00Z' }], maps).markets.length,
    0,
  );
  const result = normalizeUnabatedProps([row, { ...row, price: -130 }], maps);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.markets[0].prices[0].available, false);
});
const leg: SlipLeg = {
  id: 'prop',
  eventId: 'event',
  playerId: 'player',
  marketType: 'PASSING_YARDS',
  period: 'game',
  side: 'OVER',
  line: 224.5,
  odds: 108,
  sportsbook: 'FANDUEL',
  available: true,
};
const offer = { ...leg, offerId: 'returned-offer', region: 'IL', verifiedUntil: 200 };
const result = {
  book: 'FanDuel',
  deepLink: 'https://gambly.com/deeplink/deeplink-cache-fixture',
  legsRequested: 1,
  legsMatched: 1,
  betslipBets: [{ id: offer.offerId, isLive: false, odds: { points: '224.50' } }],
};
test('generated slip requires independently resolved exact direction, threshold, region and freshness', () => {
  assert.equal(
    verifyGeneratedFanDuelSlip([leg], result, [offer], { now: 100, region: 'IL' }).supported,
    true,
  );
  for (const offers of [
    [],
    [{ ...offer, side: 'UNDER' }],
    [{ ...offer, line: 219.5 }],
    [{ ...offer, region: 'NY' }],
    [{ ...offer, verifiedUntil: 50 }],
    [{ ...offer, available: false }],
  ])
    assert.equal(
      verifyGeneratedFanDuelSlip([leg], result, offers, { now: 100, region: 'IL' }).supported,
      false,
    );
  assert.equal(
    verifyGeneratedFanDuelSlip(
      [leg],
      { ...result, betslipBets: [{ id: offer.offerId, isLive: false, odds: { points: '219.5' } }] },
      [offer],
      { now: 100, region: 'IL' },
    ).supported,
    false,
  );
});
test('counts alone never qualify a partial, substituted, duplicate or unmatched complete slip', () => {
  const second = { ...leg, id: 'second', playerId: 'second-player' };
  assert.equal(
    verifyGeneratedFanDuelSlip([leg, second], { ...result, legsRequested: 2 }, [offer], {
      now: 100,
      region: 'IL',
    }).supported,
    false,
  );
  assert.equal(
    verifyGeneratedFanDuelSlip([leg], result, [], { now: 100, region: 'IL' }).supported,
    false,
  );
});
