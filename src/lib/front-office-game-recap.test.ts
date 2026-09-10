import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameSimulationResult } from './front-office-game-recap';
import type { FranchiseGameState, FranchiseTeamState, SimulatedPlayer } from '@/types/front-office';

const teams: Record<string, FranchiseTeamState> = {
  KC: {
    abbr: 'KC',
    conference: 'AFC',
    division: 'West',
    overall: 88,
    record: { wins: 1, losses: 0, ties: 0 },
    pointsFor: 27,
    pointsAgainst: 20,
  },
  DEN: {
    abbr: 'DEN',
    conference: 'AFC',
    division: 'West',
    overall: 81,
    record: { wins: 0, losses: 1, ties: 0 },
    pointsFor: 20,
    pointsAgainst: 27,
  },
};

const positions = ['QB', 'RB', 'WR', 'WR', 'WR', 'TE', 'EDGE', 'DT', 'LB', 'CB', 'S'];
const players: SimulatedPlayer[] = ['KC', 'DEN'].flatMap((team) =>
  positions.map((position, index) => ({
    id: `${team}-${position}-${index}`,
    name: `${team} ${position} ${index}`,
    teamAbbr: team,
    position,
    rating: 72 + index,
    headshotUrl: null,
  })),
);

const game = (
  homeScore: number,
  awayScore: number,
  winner: string | null,
  overtime = false,
): FranchiseGameState => ({
  id: 'game-1',
  week: 9,
  seasonType: 'REG',
  homeTeam: 'KC',
  awayTeam: 'DEN',
  played: true,
  homeScore,
  awayScore,
  winner,
  overtime,
});

test('box score is deterministic and internally consistent', () => {
  const first = createGameSimulationResult({
    game: game(27, 20, 'KC'),
    teams,
    players,
    seed: 'save-seed',
  });
  const second = createGameSimulationResult({
    game: game(27, 20, 'KC'),
    teams,
    players,
    seed: 'save-seed',
  });
  assert.deepEqual(first, second);
  for (const team of ['KC', 'DEN']) {
    const stats = first.playerStats.filter((stat) => stat.teamAbbr === team);
    const qb = stats.find((stat) => stat.passingYards !== undefined)!;
    assert.equal(
      stats.reduce((sum, stat) => sum + (stat.receivingYards ?? 0), 0),
      qb.passingYards,
    );
    assert.equal(
      stats.reduce((sum, stat) => sum + (stat.receivingTD ?? 0), 0),
      qb.passingTD,
    );
    assert.equal(
      stats.reduce((sum, stat) => sum + (stat.sacks ?? 0), 0),
      first.teamStats[team].sacks,
    );
    assert.equal(first.topPerformers[team].length, 3);
    assert.ok(first.topPerformers[team].every((id) => stats.some((stat) => stat.playerId === id)));
  }
  const kcDefensiveInts = first.playerStats
    .filter((stat) => stat.teamAbbr === 'KC')
    .reduce((sum, stat) => sum + (stat.defensiveInterceptions ?? 0), 0);
  assert.equal(kcDefensiveInts, first.teamStats.DEN.interceptions);
});

test('touchdown and sack distributions reconcile across scoring ranges', () => {
  for (const score of [3, 10, 17, 24, 31, 42, 49]) {
    const result = createGameSimulationResult({
      game: game(score, 20, score === 20 ? null : score > 20 ? 'KC' : 'DEN'),
      teams,
      players,
      seed: `range-${score}`,
    });
    for (const team of ['KC', 'DEN']) {
      const stats = result.playerStats.filter((stat) => stat.teamAbbr === team);
      assert.equal(
        stats.reduce((sum, stat) => sum + (stat.receivingTD ?? 0), 0),
        result.teamStats[team].passingTD,
      );
      assert.equal(
        stats.reduce((sum, stat) => sum + (stat.sacks ?? 0), 0),
        result.teamStats[team].sacks,
      );
    }
  }
});

test('recap copy handles wins, losses, ties, and overtime', () => {
  const win = createGameSimulationResult({ game: game(27, 20, 'KC'), teams, players, seed: 'win' });
  const loss = createGameSimulationResult({
    game: game(17, 24, 'DEN'),
    teams,
    players,
    seed: 'loss',
  });
  const tie = createGameSimulationResult({ game: game(24, 24, null), teams, players, seed: 'tie' });
  const overtime = createGameSimulationResult({
    game: game(30, 27, 'KC', true),
    teams,
    players,
    seed: 'ot',
  });
  assert.match(win.recapHeadline.KC, /KC/);
  assert.match(loss.recapHeadline.KC, /LOSS|SHORT/);
  assert.match(tie.recapHeadline.KC, /TIE/);
  assert.equal(overtime.overtime, true);
});
