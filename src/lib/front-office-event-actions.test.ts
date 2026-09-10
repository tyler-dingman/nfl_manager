import assert from 'node:assert/strict';
import test from 'node:test';

import type { FrontOfficeEvent } from '@/types/front-office';
import {
  getFrontOfficeEventActionLabel,
  getFrontOfficeEventActionUrl,
} from './front-office-event-actions';

const tradeRequest: FrontOfficeEvent = {
  id: 'event-chris-jones',
  saveId: 'save-1',
  type: 'trade_rumor',
  priority: 'high',
  headline: 'Chris Jones has requested a trade',
  summary: 'He is unhappy with contract discussions.',
  teamAbbr: 'KC',
  relatedTeamAbbr: 'MIA',
  playerId: 'chris-jones-id',
  prospectId: null,
  tradeOfferId: null,
  simulationSeason: 2026,
  simulationWeek: 4,
  simulationPhase: 'regular-season',
  actionUrl: '/manage/trades',
  metadata: { requestedTrade: true },
  createdAt: '2026-09-09T00:00:00.000Z',
  expiresAt: null,
  readAt: null,
  dismissedAt: null,
  surfacedAt: null,
};

test('trade request opens Trade Hub with the user player and interested team preselected', () => {
  assert.equal(
    getFrontOfficeEventActionUrl(tradeRequest),
    '/manage/trades?playerId=chris-jones-id&partnerTeamAbbr=MIA&source=league-wire&eventId=event-chris-jones',
  );
  assert.equal(getFrontOfficeEventActionLabel(tradeRequest), 'Explore Trade');
});

test('persisted trade offers retain their offer review deep link', () => {
  const offer = {
    ...tradeRequest,
    type: 'trade_offer' as const,
    actionUrl: '/manage/trades?offer=o1',
  };
  assert.equal(getFrontOfficeEventActionUrl(offer), '/manage/trades?offer=o1');
  assert.equal(getFrontOfficeEventActionLabel(offer), 'View offer');
});

test('re-sign ready opens the canonical negotiation flow for the referenced player', () => {
  const event = {
    ...tradeRequest,
    id: 'ready-event',
    type: 're_sign_ready' as const,
    playerId: 'expiring-player',
    actionUrl: '/roster?view=resign&playerId=expiring-player&openNegotiation=1',
  };
  assert.equal(
    getFrontOfficeEventActionUrl(event),
    '/roster?view=resign&playerId=expiring-player&openNegotiation=1&eventId=ready-event',
  );
  assert.equal(getFrontOfficeEventActionLabel(event), 'Start Negotiations');
});
