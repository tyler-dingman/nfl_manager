import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createEmptyTradeOfferScope,
  registerTradeOfferNotInterested,
  registerTradeOfferShown,
  shouldRequestTradeOffer,
} from '@/features/trades/trade-toast-orchestrator';
import type { TradeOfferDTO } from '@/types/trade-offers';

const offer: TradeOfferDTO = {
  id: 'offer-1',
  phase: 'manage',
  archetype: 'buried_depth',
  trigger: 'visit',
  generatedAt: new Date().toISOString(),
  chartModel: 'drafttek-classic',
  proposingTeamAbbr: 'SEA',
  proposingTeamName: 'Seattle Seahawks',
  proposingTeamLogoUrl: '/logo.svg',
  headline: 'Test offer',
  summary: 'Summary',
  reason: 'Reason',
  incoming: { teamAbbr: 'SEA', teamName: 'Seattle Seahawks', totalValue: 100, assets: [] },
  outgoing: { teamAbbr: 'KC', teamName: 'Kansas City Chiefs', totalValue: 90, assets: [] },
  userInterest: { label: 'Fair', band: 'fair', score: 1 },
  aiInterest: { label: 'Fair', band: 'fair', score: 1 },
  debug: { seed: 'seed', candidateScore: 100, userScore: 1, aiScore: 1, reasons: [] },
};

test('no-spam pacing blocks repeated manage offers during cooldown', () => {
  const scope = registerTradeOfferShown(createEmptyTradeOfferScope(), offer, 1_000);
  assert.equal(shouldRequestTradeOffer({ phase: 'manage', scope, now: 5_000 }), false);
});

test('draft pacing waits several picks before next offer', () => {
  const scope = registerTradeOfferShown(
    createEmptyTradeOfferScope(),
    { ...offer, phase: 'draft' },
    1_000,
    10,
  );
  assert.equal(
    shouldRequestTradeOffer({ phase: 'draft', scope, currentDraftPickIndex: 12, now: 2_000 }),
    false,
  );
  assert.equal(
    shouldRequestTradeOffer({ phase: 'draft', scope, currentDraftPickIndex: 14, now: 2_000 }),
    true,
  );
});

test('not interested mutes future proposals from that team in scope state', () => {
  const scope = registerTradeOfferNotInterested(createEmptyTradeOfferScope(), offer);
  assert.deepEqual(scope.mutedTeamAbbrs, ['SEA']);
});
