import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlayerDetailsModel } from './player-details';
import { getTeamBrandTheme } from './team-brand-themes';
import type { PlayerRowDTO } from '@/types/player';
import type { TeamDTO } from '@/types/team';
const player: PlayerRowDTO = {
  id: 'jaylon',
  firstName: 'Jaylon',
  lastName: 'Johnson',
  position: 'CB',
  rating: 94,
  age: 26,
  teamAbbr: 'CHI',
  contractYearsRemaining: 2,
  capHit: '$24.5M',
  capHitValue: 24.5,
  status: 'Active',
  stats: { tackles: 6, interceptionsDef: 0, passDeflections: 0 },
};
const teams = ['CHI', 'KC', 'GB', 'LAR', 'MIA', 'BAL'].map(
  (abbr) =>
    ({
      id: abbr,
      abbr,
      name: abbr === 'CHI' ? 'Chicago Bears' : abbr,
      logoUrl: `/${abbr}.svg`,
      colors: [],
      teamOverview: 80,
      offenseOverview: 80,
      defenseOverview: 80,
      specialTeamsOverview: 80,
      teamOverviewGrade: 'B',
      teamNeeds: [],
    }) satisfies TeamDTO,
);
const build = (p: PlayerRowDTO, kind: 'roster' | 'freeAgent' = 'roster') =>
  buildPlayerDetailsModel({
    source: { kind, player: p },
    roster: [p],
    teams,
    userTeamAbbr: 'CHI',
    capSpace: 30,
    capLimit: 300,
    season: 2028,
  });
test('Jaylon retains actual OVR, current-save contract year, and grammatical summary', () => {
  const m = build(player);
  assert.equal(m.rating, 94);
  assert.equal(m.bestRole, 'CB1');
  assert.match(m.summary, /for the Chicago Bears/);
  assert.equal(m.contract.find((i) => i.label === 'Final Year')?.value, '2029');
  assert.equal(m.contractValueTag, null);
});
test('free agents do not inherit the user team, old contract, or depth role', () => {
  const m = build({ ...player, isUnsigned: true, lastTeamAbbr: 'CHI' }, 'freeAgent');
  assert.equal(m.teamAbbr, null);
  assert.equal(m.teamLogoUrl, null);
  assert.equal(m.bestRole, null);
  assert.ok(m.contract.every((i) => i.label === 'APY / Market'));
});
test('current simulated team takes priority over original team', () => {
  for (const team of teams) {
    const m = build({ ...player, currentTeamAbbr: team.abbr });
    assert.equal(m.teamAbbr, team.abbr);
    assert.equal(m.teamLogoUrl, `/${team.abbr}.svg`);
    assert.ok(getTeamBrandTheme(team.abbr).primary);
  }
});
test('stats adapt to position and unsupported blocking metrics stay empty', () => {
  const stats = {
    passingYards: 4200,
    rushYards: 900,
    receptions: 70,
    tackles: 80,
    sacks: 12,
    interceptionsDef: 3,
  };
  for (const [position, label] of [
    ['QB', 'Pass Yards'],
    ['RB', 'Rush Yards'],
    ['WR', 'Receptions'],
    ['EDGE', 'Sacks'],
    ['LB', 'Tackles'],
    ['CB', 'INT'],
    ['S', 'INT'],
  ])
    assert.ok(build({ ...player, position, stats }).stats.some((s) => s.label === label));
  for (const position of ['OT', 'K', 'P'])
    assert.deepEqual(build({ ...player, position, stats }).stats, []);
});
test('incomplete, expiring, rookie, and practice-squad records do not fabricate contract values', () => {
  const incomplete = build({
    ...player,
    headshotUrl: null,
    capHit: '',
    capHitValue: undefined,
    contractYearsRemaining: 0,
  });
  assert.deepEqual(incomplete.contract, []);
  const expiring = build({ ...player, contractYearsRemaining: 1 });
  assert.match(expiring.contractStatusLine, /1 year remaining/);
  const rookie = build({
    ...player,
    age: 23,
    rating: 80,
    averagePerYear: 3,
    contractYearsRemaining: 4,
  });
  assert.equal(rookie.contractValueTag, 'Rookie Value');
  assert.equal(build({ ...player, status: 'Practice Squad' }).name, 'Jaylon Johnson');
});
