import test from 'node:test';
import assert from 'node:assert/strict';

import { detectActiveDraftRuns, evaluateDraftPick, summarizeDraftClass } from '@/lib/draft-intelligence';
import type { DraftPickDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';

const makePlayer = (
  overrides: Partial<PlayerRowDTO> & Pick<PlayerRowDTO, 'id' | 'firstName' | 'lastName' | 'position'>,
): PlayerRowDTO => {
  const { id, firstName, lastName, position, ...rest } = overrides;
  return {
    ...rest,
    id,
    firstName,
    lastName,
    position,
    age: 22,
    rating: 78,
    rank: 18,
    projectedPick: 18,
    contractYearsRemaining: 4,
    capHit: '$0.0M',
    status: 'Available',
  };
};

const makePick = (overall: number, selectedPlayerId: string | null): DraftPickDTO => ({
  id: `pick-${overall}`,
  overall,
  round: 1,
  ownerTeamAbbr: 'KC',
  originalTeamAbbr: 'KC',
  selectedPlayerId,
  selectedByTeamAbbr: selectedPlayerId ? 'KC' : null,
});

test('evaluateDraftPick rewards value and needs', () => {
  const evaluation = evaluateDraftPick({
    player: makePlayer({
      id: 'ot-1',
      firstName: 'Brick',
      lastName: 'Wall',
      position: 'LT',
      rating: 81,
      rank: 8,
      projectedPick: 8,
    }),
    currentPickOverall: 16,
    teamNeeds: ['OT', 'CB', 'WR'],
    boardEntry: {
      player: makePlayer({
        id: 'ot-1',
        firstName: 'Brick',
        lastName: 'Wall',
        position: 'LT',
      }),
      boardScore: 88,
      fitScore: 18,
      valueDelta: 8,
      tags: ['Best Available', 'Team Need'],
    },
  });

  assert.ok(['A+', 'A'].includes(evaluation.grade));
  assert.ok(evaluation.reasons.includes('Filled a major team need'));
});

test('detectActiveDraftRuns spots wide receiver run', () => {
  const players = [
    makePlayer({ id: 'wr-1', firstName: 'One', lastName: 'Receiver', position: 'WR' }),
    makePlayer({ id: 'wr-2', firstName: 'Two', lastName: 'Receiver', position: 'WR' }),
    makePlayer({ id: 'wr-3', firstName: 'Three', lastName: 'Receiver', position: 'WR' }),
  ];
  const runs = detectActiveDraftRuns(
    [makePick(10, 'wr-1'), makePick(12, 'wr-2'), makePick(15, 'wr-3')],
    players,
  );

  assert.equal(runs[0]?.position, 'WR');
});

test('summarizeDraftClass builds useful running summary', () => {
  const picks = [
    {
      player: makePlayer({ id: 'cb-1', firstName: 'Lock', lastName: 'Down', position: 'CB' }),
      pick: makePick(14, 'cb-1'),
    },
    {
      player: makePlayer({ id: 'ot-1', firstName: 'Brick', lastName: 'Wall', position: 'LT' }),
      pick: makePick(28, 'ot-1'),
    },
  ];
  const evaluations = [
    evaluateDraftPick({
      player: picks[0].player,
      currentPickOverall: 14,
      teamNeeds: ['CB', 'OT', 'WR'],
    }),
    evaluateDraftPick({
      player: picks[1].player,
      currentPickOverall: 28,
      teamNeeds: ['CB', 'OT', 'WR'],
    }),
  ];

  const summary = summarizeDraftClass({
    picks,
    evaluations,
    teamNeeds: ['CB', 'OT', 'WR'],
  });

  assert.equal(summary.pickCount, 2);
  assert.equal(summary.needsAddressed, 2);
  assert.ok(summary.summaryLines.length >= 2);
});
