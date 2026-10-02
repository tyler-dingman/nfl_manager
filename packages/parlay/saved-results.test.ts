import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotSavedPlay } from '../../src/components/parlay-lab/saved-plays';
import { applySavedPlayResults } from './saved-results';

test('grading duplicate market IDs applies each result once and preserves saved prices', () => {
  const play = snapshotSavedPlay({
    selections: [
      {
        id: 'same',
        marketType: 'PASSING_YARDS',
        side: 'OVER',
        line: 200.5,
        odds: -110,
        sportsbook: 'FANDUEL',
      },
      {
        id: 'same',
        marketType: 'PASSING_YARDS',
        side: 'UNDER',
        line: 200.5,
        odds: -105,
        sportsbook: 'DRAFTKINGS',
      },
    ],
  });
  const [next] = applySavedPlayResults(
    [play],
    [
      {
        id: play.id,
        status: 'MISSED',
        legs: [
          { id: 'same', status: 'HIT', actualResult: 250 },
          { id: 'same', status: 'MISS', actualResult: 250 },
        ],
      },
    ],
  );
  assert.deepEqual(
    next.selections.map((leg) => leg.gradingStatus),
    ['HIT', 'MISS'],
  );
  assert.deepEqual(
    next.selections.map((leg) => leg.odds),
    [-110, -105],
  );
  assert.equal(next.status, 'MISSED');
  assert.equal(play.status, 'UPCOMING');
});

test('missing result preserves the saved snapshot', () => {
  const play = snapshotSavedPlay({ selections: [] });
  assert.equal(applySavedPlayResults([play], [])[0], play);
});
