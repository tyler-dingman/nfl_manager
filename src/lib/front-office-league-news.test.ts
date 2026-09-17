import assert from 'node:assert/strict';
import test from 'node:test';

import { eventToLeagueNewsStory, storyTemplateFor } from './front-office-league-news';
import type { FrontOfficeEvent } from '@/types/front-office';

const event = (overrides: Partial<FrontOfficeEvent> = {}): FrontOfficeEvent => ({
  id: 'story-1',
  saveId: 'save-1',
  type: 'contract_extension',
  priority: 'normal',
  headline: 'Team and player agree to an extension',
  summary: 'Terms were finalized today.',
  teamAbbr: 'CHI',
  relatedTeamAbbr: null,
  playerId: null,
  prospectId: null,
  tradeOfferId: null,
  simulationSeason: 2026,
  simulationWeek: 1,
  simulationPhase: 'REG',
  actionUrl: null,
  metadata: {},
  createdAt: '2026-09-17T12:00:00.000Z',
  expiresAt: null,
  readAt: null,
  dismissedAt: null,
  surfacedAt: null,
  ...overrides,
});

test('structured category wins over headline wording', () => {
  const contract = event({
    headline: 'Trade chatter follows a new contract agreement',
    metadata: { newsCategory: 'CONTRACT' },
  });
  assert.equal(storyTemplateFor(contract), 'contract');
});

test('trade offers use trade artwork', () => {
  assert.equal(storyTemplateFor(event({ type: 'trade_offer' })), 'trade');
});

test('breaking is layered over the underlying story type', () => {
  const story = eventToLeagueNewsStory(
    event({ priority: 'urgent', metadata: { newsCategory: 'INJURY' } }),
    'CHI',
  );
  assert.equal(story.storyTemplate, 'injury');
  assert.equal(story.isBreaking, true);
});
