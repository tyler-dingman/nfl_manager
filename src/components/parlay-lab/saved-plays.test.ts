import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveSavedPlayStatus, normalizedSavedMarketType, snapshotSavedPlay } from './saved-plays';

test('snapshots saved prices and calculates combined American odds', () => {
  const play = snapshotSavedPlay({
    selections: [
      {
        id: 'a',
        marketType: 'PASSING_YARDS',
        side: 'OVER',
        line: 200.5,
        odds: -110,
        sportsbook: 'FANDUEL',
      },
      {
        id: 'b',
        marketType: 'RUSHING_YARDS',
        side: 'UNDER',
        line: 60.5,
        odds: -110,
        sportsbook: 'DRAFTKINGS',
      },
    ],
  });
  assert.equal(play.savedCombinedOdds, 264);
  assert.equal(play.selections[0].line, 200.5);
  assert.equal(play.selections[1].sportsbook, 'DRAFTKINGS');
});

test('normalizes provider labels before grading and display', () => {
  assert.equal(
    normalizedSavedMarketType({ marketType: 'OTHER', statId: 'passingTouchdowns' }),
    'PASSING_TDS',
  );
  assert.equal(
    normalizedSavedMarketType({ marketType: 'OTHER', statId: 'receivingReceptions' }),
    'RECEPTIONS',
  );
});

test('derives overall research result without implying a wager payout', () => {
  assert.equal(deriveSavedPlayStatus(['HIT', 'HIT']), 'HIT');
  assert.equal(deriveSavedPlayStatus(['HIT', 'MISS']), 'MISSED');
  assert.equal(deriveSavedPlayStatus(['HIT', 'LIVE']), 'LIVE');
  assert.equal(deriveSavedPlayStatus(['HIT', 'HIT', 'VOID']), 'HIT');
  assert.equal(deriveSavedPlayStatus(['VOID', 'VOID']), 'VOID');
});

test('snapshots Lab Find provenance without inventing it for unknown legs', () => {
  const play = snapshotSavedPlay({
    selections: [
      {
        id: 'lab',
        marketType: 'RUSHING_YARDS',
        side: 'OVER',
        line: 60.5,
        odds: -110,
        sportsbook: 'FANDUEL',
        labResearch: { labFindSide: 'OVER' },
      },
      {
        id: 'plain',
        marketType: 'RECEPTIONS',
        side: 'OVER',
        line: 3.5,
        odds: -105,
        sportsbook: 'FANDUEL',
      },
    ],
  });
  assert.equal(play.selections[0].wasLabFindAtSave, true);
  assert.equal(play.selections[1].wasLabFindAtSave, false);
});
