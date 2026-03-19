import test from 'node:test';
import assert from 'node:assert/strict';

import { getDraftAutopick, rankDraftBoard } from '@/lib/draft-board';
import type { PlayerRowDTO } from '@/types/player';

const makeProspect = (
  overrides: Partial<PlayerRowDTO> & Pick<PlayerRowDTO, 'id' | 'firstName' | 'lastName' | 'position'>,
): PlayerRowDTO => ({
  id: overrides.id,
  firstName: overrides.firstName,
  lastName: overrides.lastName,
  position: overrides.position,
  age: 22,
  rating: 75,
  rank: 20,
  projectedPick: 20,
  contractYearsRemaining: 4,
  capHit: '$0.0M',
  status: 'Available',
  ...overrides,
});

test('rankDraftBoard prioritizes best available and team need', () => {
  const board = rankDraftBoard({
    prospects: [
      makeProspect({ id: 'wr-1', firstName: 'Alpha', lastName: 'Wideout', position: 'WR', rating: 82, rank: 9, projectedPick: 9 }),
      makeProspect({ id: 'ot-1', firstName: 'Brick', lastName: 'Wall', position: 'LT', rating: 80, rank: 12, projectedPick: 10 }),
      makeProspect({ id: 'cb-1', firstName: 'Lock', lastName: 'Down', position: 'CB', rating: 78, rank: 18, projectedPick: 18 }),
    ],
    teamNeeds: ['OT', 'CB', 'WR'],
    currentPickOverall: 14,
    limit: 3,
  });

  assert.equal(board[0]?.player.id, 'ot-1');
  assert.ok(board[0]?.tags.includes('Best Available'));
  assert.ok(board[0]?.tags.includes('Team Need'));
});

test('getDraftAutopick returns a steal when value and need align', () => {
  const player = getDraftAutopick({
    prospects: [
      makeProspect({ id: 'edge-1', firstName: 'Edge', lastName: 'Rush', position: 'EDGE', rating: 79, rank: 8, projectedPick: 8 }),
      makeProspect({ id: 'dl-1', firstName: 'Big', lastName: 'Body', position: 'DT', rating: 81, rank: 16, projectedPick: 16 }),
    ],
    teamNeeds: ['DL', 'CB', 'WR'],
    currentPickOverall: 21,
  });

  assert.equal(player?.id, 'dl-1');
});
