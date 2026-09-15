import assert from 'node:assert/strict';
import test from 'node:test';
import { generateResearchSlip, parseResearchPrompt, type ResearchCandidate } from './research';

test('parses leg count, matchup teams, and direction', () => {
  assert.deepEqual(parseResearchPrompt('Build a 3-leg parlay for Chiefs vs Broncos overs'), {
    legCount: 3,
    teams: ['KC', 'DEN'],
    positions: [],
    side: 'OVER',
    touchdownsOnly: false,
    plusMoney: false,
    confidence: 'balanced',
  });
});

test('parses high-confidence touchdown requests', () => {
  const result = parseResearchPrompt('Give me 2 safer QB TD picks');
  assert.equal(result.legCount, 2);
  assert.equal(result.confidence, 'high');
  assert.equal(result.touchdownsOnly, true);
  assert.deepEqual(result.positions, ['QB']);
});

test('research generation does not require a sportsbook deeplink or price', () => {
  const candidate: ResearchCandidate = {
    id: 'market-1',
    playerName: 'Patrick Mahomes',
    position: 'QB',
    teamId: 'KC',
    marketType: 'PASSING_YARDS',
    statId: 'passing_yards',
    side: 'OVER',
    line: 224.5,
    sportsbook: 'FANDUEL',
    odds: null,
    deeplink: null,
    trend: {
      trendScore: 82,
      sampleConfidence: 'HIGH',
      last10: { games: 10, hits: 8 },
    },
  };
  assert.deepEqual(generateResearchSlip([candidate], parseResearchPrompt('safer 1 leg')), [
    candidate,
  ]);
});
