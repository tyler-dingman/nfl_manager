import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addSlipLeg,
  compatibleSlipTransfers,
  slipKey,
  slipOdds,
  type SlipLeg,
  type SlipTransferIntegration,
} from './slip';
const leg: SlipLeg = {
  id: 'one',
  eventId: 'event',
  playerId: 'player',
  marketType: 'RECEPTIONS',
  period: 'game',
  side: 'OVER',
  line: 4.5,
  odds: -200,
  sportsbook: 'FANDUEL',
  available: true,
};
const second = { ...leg, id: 'two', playerId: 'another', odds: 150 };
const adapter: SlipTransferIntegration = {
  sportsbook: 'FANDUEL',
  name: 'Test adapter',
  verifyAndBuild: (legs) => ({
    sportsbook: 'FANDUEL',
    name: 'Test adapter',
    url: `https://example.test/slip?legs=${legs.map(slipKey).map(encodeURIComponent).join(',')}`,
    selectionKeys: legs.map(slipKey),
  }),
};
test('duplicates across books and conflicting direction or threshold cannot coexist', () => {
  assert.equal(addSlipLeg([leg], { ...leg, sportsbook: 'DRAFTKINGS' }).length, 1);
  assert.deepEqual(
    addSlipLeg([leg], { ...leg, id: 'replacement', side: 'UNDER' }).map((m) => m.side),
    ['UNDER'],
  );
  assert.equal(addSlipLeg([leg], second).length, 2);
});
test('combined odds use selected prices and unknown odds remain unknown', () => {
  assert.equal(slipOdds([leg, second]), 275);
  assert.equal(slipOdds([{ ...leg, odds: null }, second]), null);
  assert.equal(slipOdds([]), null);
});
test('no configured integration means no CTA even with every offer present', () => {
  assert.deepEqual(compatibleSlipTransfers([leg, second], [leg, second]), []);
});
test('full-slip gating requires every exact market and complete transfer acknowledgement', () => {
  const legs = [leg, second];
  assert.equal(compatibleSlipTransfers(legs, legs, [adapter]).length, 1);
  assert.equal(compatibleSlipTransfers(legs, [leg], [adapter]).length, 0);
  assert.equal(compatibleSlipTransfers(legs, [leg, { ...second, line: 5.5 }], [adapter]).length, 0);
  assert.equal(
    compatibleSlipTransfers(legs, legs, [{ ...adapter, verifyAndBuild: () => null }]).length,
    0,
  );
  assert.equal(
    compatibleSlipTransfers(legs, legs, [
      {
        ...adapter,
        verifyAndBuild: () => ({
          ...adapter.verifyAndBuild(legs, legs)!,
          selectionKeys: [slipKey(leg)],
        }),
      },
    ]).length,
    0,
  );
  const dk = {
    ...adapter,
    sportsbook: 'DRAFTKINGS',
    verifyAndBuild: (items: SlipLeg[]) => ({
      ...adapter.verifyAndBuild(items, items)!,
      sportsbook: 'DRAFTKINGS',
    }),
  };
  assert.equal(
    compatibleSlipTransfers(
      legs,
      [...legs, ...legs.map((m) => ({ ...m, sportsbook: 'DRAFTKINGS' }))],
      [adapter, dk],
    ).length,
    2,
  );
});

test('single FanDuel selection transfers the exact provider URL', () => {
  const offer = {
    ...leg,
    deeplink:
      'https://sportsbook.fanduel.com/addToBetslip?marketId=42.614817271&selectionId=41066836',
  };
  assert.equal(compatibleSlipTransfers([leg], [offer])[0]?.url, offer.deeplink);
  assert.deepEqual(compatibleSlipTransfers([leg, second], [offer, second]), []);
  assert.deepEqual(compatibleSlipTransfers([leg], [{ ...offer, line: 5.5 }]), []);
  assert.deepEqual(compatibleSlipTransfers([leg], [{ ...offer, available: false }]), []);
});
test('missing, generic, wrong-host, and multi-selection links cannot transfer', () => {
  for (const deeplink of [
    null,
    'https://sportsbook.fanduel.com/',
    'https://sportsbook.fanduel.com/addToBetslip?marketId=42.123',
    'https://example.com/addToBetslip?marketId=42.123&selectionId=123',
    'https://sportsbook.fanduel.com/addToBetslip?marketId=42.123&selectionId=123&selectionId=456',
    'https://sportsbook.fanduel.com/addToBetslip?marketId=42.123&selectionId=123&marketId[1]=42.456',
  ])
    assert.deepEqual(compatibleSlipTransfers([leg], [{ ...leg, deeplink }]), []);
});
