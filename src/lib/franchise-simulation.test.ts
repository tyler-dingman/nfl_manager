import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceSimulation,
  createFranchiseSimulation,
  normalizeFranchiseSimulationState,
  seedPlayoffs,
  simulateGame,
  startFranchiseAtWeekOne,
} from '@/lib/franchise-simulation';
import type {
  FranchiseGameState,
  FranchiseSimulationState,
  FranchiseTeamState,
} from '@/types/front-office';

test('normalizes repeatedly encoded simulation state at the simulation boundary', () => {
  const encoded = JSON.stringify(
    JSON.stringify(
      JSON.stringify({
        currentWeek: 0,
        phase: 'preseason',
        teams: {},
        games: [],
      }),
    ),
  );
  assert.equal(normalizeFranchiseSimulationState(encoded)?.phase, 'week-1');
  assert.equal(
    advanceSimulation(encoded as unknown as FranchiseSimulationState, 'week-2').phase,
    'week-2',
  );
});

const team = (abbr: string, overall: number, conference = 'AFC', division = 'East') => ({
  abbr,
  overall,
  conference,
  division,
});

test('a new Week 1 save starts 0-0 before the opening game is played', () => {
  const state = startFranchiseAtWeekOne(
    createFranchiseSimulation({
      seed: 'new-save',
      season: 2026,
      teams: [team('AAA', 82), team('BBB', 79)],
      games: [{ id: 'week-one', week: 1, homeTeam: 'AAA', awayTeam: 'BBB' }],
    }),
  );

  assert.equal(state.phase, 'week-1');
  assert.equal(state.currentWeek, 0);
  assert.deepEqual(state.teams.AAA.record, { wins: 0, losses: 0, ties: 0 });
  assert.deepEqual(state.teams.BBB.record, { wins: 0, losses: 0, ties: 0 });
  assert.equal(state.games[0].played, false);
  assert.equal(state.games[0].homeScore, null);
  assert.equal(state.games[0].awayScore, null);
});

test('a completed game is deterministic and cannot reroll', () => {
  const teams: Record<string, FranchiseTeamState> = Object.fromEntries(
    [team('AAA', 90), team('BBB', 70)].map((entry) => [
      entry.abbr,
      { ...entry, record: { wins: 0, losses: 0, ties: 0 }, pointsFor: 0, pointsAgainst: 0 },
    ]),
  );
  const game: FranchiseGameState = {
    id: 'game-1',
    week: 1,
    seasonType: 'REG',
    homeTeam: 'AAA',
    awayTeam: 'BBB',
    played: false,
    homeScore: null,
    awayScore: null,
    winner: null,
  };
  const result = simulateGame(game, teams, 'save-seed');
  assert.deepEqual(simulateGame(result, teams, 'different-seed'), result);
});

test('a 90 OVR team wins materially more seeded games than a 70 OVR team', () => {
  let strongWins = 0;
  for (let index = 0; index < 200; index += 1) {
    const teams: Record<string, FranchiseTeamState> = {
      AAA: {
        ...team('AAA', 90),
        record: { wins: 0, losses: 0, ties: 0 },
        pointsFor: 0,
        pointsAgainst: 0,
      },
      BBB: {
        ...team('BBB', 70),
        record: { wins: 0, losses: 0, ties: 0 },
        pointsFor: 0,
        pointsAgainst: 0,
      },
    };
    const result = simulateGame(
      {
        id: `game-${index}`,
        week: 1,
        seasonType: 'REG',
        homeTeam: index % 2 ? 'AAA' : 'BBB',
        awayTeam: index % 2 ? 'BBB' : 'AAA',
        played: false,
        homeScore: null,
        awayScore: null,
        winner: null,
      },
      teams,
      `seed-${index}`,
    );
    if (result.winner === 'AAA') strongWins += 1;
  }
  assert.ok(strongWins > 135, `expected strong team bias, got ${strongWins}/200`);
  assert.ok(strongWins < 200);
});

test('a team at 16 wins cannot finish the regular season 17-0', () => {
  const teams: Record<string, FranchiseTeamState> = {
    AAA: {
      ...team('AAA', 99),
      record: { wins: 16, losses: 0, ties: 0 },
      pointsFor: 500,
      pointsAgainst: 100,
    },
    BBB: {
      ...team('BBB', 60),
      record: { wins: 0, losses: 16, ties: 0 },
      pointsFor: 100,
      pointsAgainst: 500,
    },
  };
  const result = simulateGame(
    {
      id: 'regular-season-finale',
      week: 18,
      seasonType: 'REG',
      homeTeam: 'AAA',
      awayTeam: 'BBB',
      played: false,
      homeScore: null,
      awayScore: null,
      winner: null,
    },
    teams,
    'win-ceiling',
  );

  assert.equal(result.winner, 'BBB');
  assert.deepEqual(teams.AAA.record, { wins: 16, losses: 1, ties: 0 });
});

test('weekly progression leaves a bye-week team unchanged', () => {
  const state = createFranchiseSimulation({
    seed: 'bye-save',
    season: 2026,
    teams: [team('AAA', 80), team('BBB', 80), team('CCC', 80)],
    games: [{ id: 'week-one', week: 1, homeTeam: 'AAA', awayTeam: 'BBB' }],
  });
  const advanced = advanceSimulation(state, 'week-2');
  assert.equal(advanced.teams.CCC.record.wins, 0);
  assert.equal(advanced.teams.CCC.record.losses, 0);
  assert.equal(advanced.games[0].played, true);
  assert.equal(state.games[0].played, false);
});

test('playoff seeding qualifies seven teams per conference with division winners', () => {
  const teams: Record<string, FranchiseTeamState> = {};
  for (const conference of ['AFC', 'NFC']) {
    for (let index = 0; index < 16; index += 1) {
      const abbr = `${conference[0]}${String(index).padStart(2, '0')}`;
      teams[abbr] = {
        ...team(abbr, 70 + index, conference, `D${index % 4}`),
        record: { wins: index, losses: 16 - index, ties: 0 },
        pointsFor: index * 20,
        pointsAgainst: 300,
      };
    }
  }
  const seeds = seedPlayoffs(teams);
  assert.equal(seeds.AFC.length, 7);
  assert.equal(seeds.NFC.length, 7);
  for (const division of ['D0', 'D1', 'D2', 'D3']) {
    assert.ok(seeds.AFC.some((abbr) => teams[abbr].division === division));
  }
});

test('full season creates and advances a 14-team bracket, champion, and 32-pick order', () => {
  const teams = Array.from({ length: 32 }, (_, index) =>
    team(
      `T${String(index).padStart(2, '0')}`,
      68 + (index % 22),
      index < 16 ? 'AFC' : 'NFC',
      `D${index % 4}`,
    ),
  );
  const games = Array.from({ length: 18 }, (_, weekIndex) =>
    Array.from({ length: 16 }, (_, gameIndex) => ({
      id: `w${weekIndex + 1}-g${gameIndex}`,
      week: weekIndex + 1,
      homeTeam: teams[gameIndex].abbr,
      awayTeam: teams[31 - gameIndex].abbr,
    })),
  ).flat();
  let state = createFranchiseSimulation({ seed: 'lifecycle', season: 2026, teams, games });
  for (let week = 2; week <= 18; week += 1) {
    state = advanceSimulation(state, `week-${week}`);
    assert.equal(state.phase, `week-${week}`);
    assert.equal(state.currentWeek, week - 1);
  }
  state = advanceSimulation(state, 'wild-card');
  assert.equal(Object.values(state.playoffs!.seeds).flat().length, 14);
  assert.equal(state.playoffs!.games.filter((game) => game.week === 1).length, 6);
  state = advanceSimulation(state, 'divisional');
  assert.equal(state.playoffs!.games.filter((game) => game.week === 2).length, 4);
  state = advanceSimulation(state, 'conference');
  assert.equal(state.playoffs!.games.filter((game) => game.week === 3).length, 2);
  state = advanceSimulation(state, 'super-bowl');
  assert.equal(state.playoffs!.games.filter((game) => game.week === 4).length, 1);
  state = advanceSimulation(state, 'scouting_combine');
  assert.ok(state.playoffs!.champion);
  assert.equal(new Set(state.draftOrder).size, 32);
  assert.equal(state.draftOrder.at(-1), state.playoffs!.champion);
  const champion = state.playoffs!.champion;
  state = advanceSimulation(state, 'free_agency');
  state = advanceSimulation(state, 'free_agency_open');
  state = advanceSimulation(state, 'draft');
  const completedGames = structuredClone(state.games);
  assert.throws(() => advanceSimulation(state, 'week-1'), /Complete the NFL Draft/);
  assert.throws(
    () =>
      advanceSimulation(state, 'week-1', {
        completedDraftSessions: [{ mode: 'mock', status: 'completed', draftYear: 2027 }],
      }),
    /Complete the NFL Draft/,
  );
  assert.throws(
    () =>
      advanceSimulation(state, 'week-1', {
        completedDraftSessions: [{ mode: 'real', status: 'completed', draftYear: 2026 }],
      }),
    /Complete the NFL Draft/,
  );
  const newSeason = advanceSimulation(state, 'week-1', {
    completedDraftSessions: [{ mode: 'real', status: 'completed', draftYear: 2027 }],
  });
  assert.equal(newSeason.season, 2027);
  assert.equal(newSeason.currentWeek, 0);
  assert.equal(newSeason.phase, 'week-1');
  assert.equal(newSeason.playoffs, null);
  assert.equal(newSeason.games.length, games.length);
  assert.ok(
    newSeason.games.every((game) => !game.played && !game.result && game.homeScore === null),
  );
  assert.ok(
    Object.values(newSeason.teams).every(
      (team) => team.record.wins === 0 && team.record.losses === 0,
    ),
  );
  assert.equal(newSeason.seasonHistory?.[0].playoffs?.champion, champion);
  assert.deepEqual(newSeason.seasonHistory?.[0].games, completedGames);
  assert.equal(advanceSimulation(newSeason, 'week-2').currentWeek, 1);
});

test('one advance plays only the opening week and invalid stage jumps cannot mutate a save', () => {
  const state = createFranchiseSimulation({
    seed: 'guard',
    season: 2026,
    teams: [team('A', 80), team('B', 80)],
    games: [1, 2].map((week) => ({ id: `game-${week}`, week, homeTeam: 'A', awayTeam: 'B' })),
  });
  const advanced = advanceSimulation(state, 'week-2');
  assert.equal(advanced.games[0].played, true);
  assert.equal(advanced.games[1].played, false);
  assert.equal(advanced.currentWeek, 1);
  for (const target of [
    'draft',
    'free_agency',
    'free_agency_open',
    'scouting_combine',
    'week-1',
    'nonsense',
  ])
    assert.throws(() => advanceSimulation(advanced, target), /Invalid franchise transition/);
  assert.equal(state.games[0].played, false);
});

test('legacy post-draft saves archive results and normalize to a fresh season exactly once', () => {
  const initial = createFranchiseSimulation({
    seed: 'migration',
    season: 2026,
    teams: [team('A', 80), team('B', 80)],
    games: [{ id: 'g', week: 1, homeTeam: 'A', awayTeam: 'B' }],
  });
  const played = advanceSimulation(initial, 'week-2');
  const normalized = normalizeFranchiseSimulationState({ ...played, phase: 'post-draft' })!;
  assert.equal(normalized.season, 2027);
  assert.equal(normalized.phase, 'week-1');
  assert.equal(normalized.games[0].played, false);
  assert.equal(normalized.seasonHistory?.[0].games[0].played, true);
  assert.deepEqual(normalizeFranchiseSimulationState(normalized), normalized);
});

test('eliminated franchises skip spectator playoff rounds while the league finishes its bracket', () => {
  const teams = Array.from({ length: 32 }, (_, index) =>
    team(`T${index}`, 65 + (index % 30), index < 16 ? 'AFC' : 'NFC', `D${index % 4}`),
  );
  const games = Array.from({ length: 18 }, (_, weekIndex) =>
    Array.from({ length: 16 }, (_, index) => ({
      id: `g-${weekIndex}-${index}`,
      week: weekIndex + 1,
      homeTeam: `T${index}`,
      awayTeam: `T${31 - index}`,
    })),
  ).flat();
  let state = createFranchiseSimulation({ seed: 'postseason-paths', season: 2026, teams, games });
  for (let week = 2; week <= 17; week++) state = advanceSimulation(state, `week-${week}`);
  const week18 = advanceSimulation(state, 'week-18');
  const bracket = advanceSimulation(week18, 'wild-card');
  const qualified = Object.values(bracket.playoffs!.seeds).flat();
  const out = teams.find((t) => !qualified.includes(t.abbr))!.abbr;
  const offseason = advanceSimulation(week18, 'wild-card', { recapTeamAbbr: out });
  assert.equal(offseason.phase, 'scouting_combine');
  assert.equal(offseason.playoffs?.games.length, 13);
  assert.ok(offseason.playoffs?.games.every((game) => game.played));
  assert.ok(offseason.playoffs?.champion);
  assert.equal(new Set(offseason.draftOrder).size, 32);
  let playoffRun = advanceSimulation(week18, 'wild-card', { recapTeamAbbr: qualified[0] });
  assert.equal(playoffRun.phase, 'wild-card');
  for (const target of ['divisional', 'conference', 'super-bowl', 'scouting_combine']) {
    if (playoffRun.phase === 'scouting_combine') break;
    playoffRun = advanceSimulation(playoffRun, target, { recapTeamAbbr: qualified[0] });
  }
  assert.equal(playoffRun.phase, 'scouting_combine');
  assert.ok(playoffRun.playoffs?.champion);
  assert.equal(advanceSimulation(offseason, 'free_agency').phase, 'free_agency');
  assert.throws(() => advanceSimulation(offseason, 'week-1'), /Invalid franchise transition/);
});
