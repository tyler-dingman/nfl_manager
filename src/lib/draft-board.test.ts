import test from 'node:test';
import assert from 'node:assert/strict';

import { filterDraftBoardEntries, getDraftAutopick, rankDraftBoard } from '@/lib/draft-board';
import type { PlayerRowDTO } from '@/types/player';

const makeProspect = (
  overrides: Partial<PlayerRowDTO> &
    Pick<PlayerRowDTO, 'id' | 'firstName' | 'lastName' | 'position'>,
): PlayerRowDTO => {
  const { id, firstName, lastName, position, ...rest } = overrides;
  return {
    id,
    firstName,
    lastName,
    position,
    age: 22,
    rating: 75,
    rank: 20,
    projectedPick: 20,
    contractYearsRemaining: 4,
    capHit: '$0.0M',
    status: 'Available',
    ...rest,
  };
};

test('rankDraftBoard preserves source rank while deriving team-need badges', () => {
  const board = rankDraftBoard({
    prospects: [
      makeProspect({
        id: 'wr-1',
        firstName: 'Alpha',
        lastName: 'Wideout',
        position: 'WR',
        rating: 82,
        rank: 9,
        projectedPick: 9,
      }),
      makeProspect({
        id: 'ot-1',
        firstName: 'Brick',
        lastName: 'Wall',
        position: 'LT',
        rating: 80,
        rank: 12,
        projectedPick: 10,
      }),
      makeProspect({
        id: 'cb-1',
        firstName: 'Lock',
        lastName: 'Down',
        position: 'CB',
        rating: 78,
        rank: 18,
        projectedPick: 18,
      }),
    ],
    teamNeeds: ['OT', 'CB', 'WR'],
    currentPickOverall: 14,
    limit: 3,
  });

  assert.equal(board[0]?.player.id, 'wr-1');
  assert.ok(board[0]?.tags.includes('Best Available'));
  assert.ok(board.find((entry) => entry.player.id === 'ot-1')?.tags.includes('Team Need'));
});

test('search, position filters, and drafted-state exclusions use the current board', () => {
  const prospects = [
    makeProspect({
      id: 'wr',
      firstName: 'Jeremiah',
      lastName: 'Smith',
      position: 'WR',
      college: 'Ohio State',
      rank: 1,
    }),
    makeProspect({
      id: 'qb',
      firstName: 'Arch',
      lastName: 'Manning',
      position: 'QB',
      college: 'Texas',
      rank: 2,
    }),
    makeProspect({
      id: 'gone',
      firstName: 'Drafted',
      lastName: 'Player',
      position: 'WR',
      rank: 3,
      isDrafted: true,
    }),
  ];
  const entries = rankDraftBoard({
    prospects,
    teamNeeds: ['WR'],
    currentPickOverall: 1,
    limit: 10,
  });
  assert.deepEqual(
    filterDraftBoardEntries(entries, 'Ohio', 'All').map((entry) => entry.player.id),
    ['wr'],
  );
  assert.deepEqual(
    filterDraftBoardEntries(entries, '', 'QB').map((entry) => entry.player.id),
    ['qb'],
  );
  assert.equal(
    entries.some((entry) => entry.player.id === 'gone'),
    false,
  );
});

test('getDraftAutopick returns the highest-ranked remaining prospect', () => {
  const player = getDraftAutopick({
    prospects: [
      makeProspect({
        id: 'edge-1',
        firstName: 'Edge',
        lastName: 'Rush',
        position: 'EDGE',
        rating: 79,
        rank: 8,
        projectedPick: 8,
      }),
      makeProspect({
        id: 'dl-1',
        firstName: 'Big',
        lastName: 'Body',
        position: 'DT',
        rating: 81,
        rank: 16,
        projectedPick: 16,
      }),
    ],
    teamNeeds: ['DL', 'CB', 'WR'],
    currentPickOverall: 21,
  });

  assert.equal(player?.id, 'edge-1');
});
