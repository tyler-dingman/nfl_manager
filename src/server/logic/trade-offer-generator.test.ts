import test from 'node:test';
import assert from 'node:assert/strict';

import { createSaveState } from '@/server/api/store';
import { generateTradeOffers } from '@/server/logic/trade-offer-generator';

test('manage trade offer generator returns realistic offers', () => {
  const state = createSaveState('trade-offer-test-manage', 'KC');
  const result = generateTradeOffers(state, {
    saveId: state.header.id,
    userTeamAbbr: 'KC',
    phase: 'manage',
    trigger: 'visit-manage-team',
    shownOfferIds: [],
  });

  assert.ok(result.offers.length >= 1);
  assert.ok(result.offers.length <= 2);
  assert.ok(result.offers.every((offer) => offer.phase === 'manage'));
  assert.ok(result.offers.every((offer) => offer.incoming.assets.length > 0));
  assert.ok(result.offers.every((offer) => offer.outgoing.assets.length > 0));
});

test('draft trade offer generator favors pick-heavy packages', () => {
  const state = createSaveState('trade-offer-test-draft', 'KC');
  const result = generateTradeOffers(state, {
    saveId: state.header.id,
    userTeamAbbr: 'KC',
    phase: 'draft',
    trigger: 'pick-18',
    shownOfferIds: [],
    draftCurrentPickIndex: 17,
  });

  assert.ok(result.offers.length >= 1);
  assert.ok(result.offers.length <= 4);
  const pickHeavyOffers = result.offers.filter(
    (offer) =>
      offer.incoming.assets.every((asset) => asset.type === 'pick') ||
      offer.incoming.assets.some((asset) => asset.type === 'pick'),
  );
  assert.ok(pickHeavyOffers.length >= 1);
});
