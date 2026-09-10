import assert from 'node:assert/strict';
import test from 'node:test';

import { createFranchiseSimulation } from '@/lib/franchise-simulation';
import type { ExpiringContractRow } from '@/lib/expiring-contracts';
import type { PlayerRowDTO } from '@/types/player';
import { rankReSignReadyCandidates, selectReSignReadyCandidate } from './re-sign-ready';

const player = (id: string, rating: number, years = 1): PlayerRowDTO => ({
  id,
  firstName: id,
  lastName: 'Player',
  position: id === 'qb' ? 'QB' : 'WR',
  rating,
  contractYearsRemaining: years,
  capHit: '$10M',
  status: 'Active',
});
const contracts: ExpiringContractRow[] = [
  ['qb', 94],
  ['wr1', 89],
  ['wr2', 84],
  ['wr3', 76],
  ['missing', 99],
].map(([id, rating]) => ({
  id: String(id),
  name: `${id} Player`,
  pos: id === 'qb' ? 'QB' : 'WR',
  teamAbbr: 'KC',
  contractType: 'UFA',
  interestPct: 70,
  age: 27,
  rating: Number(rating),
  estValue: 20_000_000,
  currentSalary: 10_000_000,
  maxValue: 80_000_000,
}));

const simulation = createFranchiseSimulation({
  seed: 'ready-seed',
  season: 2026,
  teams: [
    { abbr: 'KC', conference: 'AFC', division: 'West', overall: 88 },
    { abbr: 'DEN', conference: 'AFC', division: 'West', overall: 80 },
  ],
  games: [],
});

test('only rostered expiring players qualify and priority is capped to the top three', () => {
  const ranked = rankReSignReadyCandidates({
    teamAbbr: 'KC',
    season: 2026,
    roster: [
      player('qb', 94),
      player('wr1', 89),
      player('wr2', 84),
      player('wr3', 76),
      player('multi', 99, 3),
    ],
    expiringContracts: [...contracts, { ...contracts[0], id: 'multi', name: 'Multi Player' }],
    simulation,
  });
  assert.deepEqual(
    ranked.map((candidate) => candidate.playerId),
    ['qb', 'wr1', 'wr2'],
  );
});

test('readiness timing is deterministic and excludes an already active negotiation', () => {
  const candidates = rankReSignReadyCandidates({
    teamAbbr: 'KC',
    season: 2026,
    roster: [player('qb', 94), player('wr1', 89), player('wr2', 84)],
    expiringContracts: contracts,
    simulation,
  });
  const first = Array.from({ length: 18 }, (_, index) => index + 1)
    .map((week) =>
      selectReSignReadyCandidate({ seed: simulation.seed, week, candidates, simulation }),
    )
    .find(Boolean);
  const second = Array.from({ length: 18 }, (_, index) => index + 1)
    .map((week) =>
      selectReSignReadyCandidate({ seed: simulation.seed, week, candidates, simulation }),
    )
    .find(Boolean);
  assert.deepEqual(first, second);
  assert.ok(first);
  simulation.contractNegotiations = {
    [first!.playerId]: {
      contractId: first!.contractId,
      state: 'ready',
      readyWeek: 5,
      updatedAt: new Date(0).toISOString(),
    },
  };
  const reranked = rankReSignReadyCandidates({
    teamAbbr: 'KC',
    season: 2026,
    roster: [player('qb', 94), player('wr1', 89), player('wr2', 84)],
    expiringContracts: contracts,
    simulation,
  });
  assert.equal(
    reranked.some((candidate) => candidate.playerId === first!.playerId),
    false,
  );
});
