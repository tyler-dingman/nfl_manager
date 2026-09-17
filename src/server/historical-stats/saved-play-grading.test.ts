import assert from 'node:assert/strict';
import test from 'node:test';
import { gradeSavedLeg } from './saved-play-grading';
import type { HistoricalPlayerGame } from './types';
import type { SavedLeg } from '@/components/parlay-lab/saved-plays';

const game = { passingYards: 231 } as HistoricalPlayerGame;
const leg = {
  id: 'leg',
  marketType: 'PASSING_YARDS',
  normalizedMarketType: 'PASSING_YARDS',
  side: 'OVER',
  line: 179.5,
  odds: -110,
  sportsbook: 'FANDUEL',
} as SavedLeg;

test('grades from the saved line and final stat independent of sportsbook', () => {
  assert.deepEqual(gradeSavedLeg(leg, game), { status: 'HIT', actualResult: 231 });
  assert.deepEqual(gradeSavedLeg({ ...leg, sportsbook: 'DRAFTKINGS' }, game), {
    status: 'HIT',
    actualResult: 231,
  });
});

test('grades misses and pushes deterministically', () => {
  assert.equal(gradeSavedLeg({ ...leg, side: 'UNDER' }, game).status, 'MISS');
  assert.equal(gradeSavedLeg({ ...leg, line: 231 }, game).status, 'PUSH');
});
