import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateGame, franchiseHomeWinChance, hashSeed } from './franchise-simulation';
import type { FranchiseTeamState } from '@/types/front-office';

function season(seed: string, changedOverall?: number) {
  const teams: Record<string, FranchiseTeamState> = {};
  for (let i = 0; i < 32; i++)
    teams[`T${i}`] = {
      abbr: `T${i}`,
      conference: i < 16 ? 'AFC' : 'NFC',
      division: 'East',
      overall: i === 16 && changedOverall != null ? changedOverall : 69 + (22 * i) / 31,
      record: { wins: 0, losses: 0, ties: 0 },
      pointsFor: 0,
      pointsAgainst: 0,
    };
  const rotation = Object.keys(teams).sort(
    (a, b) => hashSeed(`${seed}:schedule:${a}`) - hashSeed(`${seed}:schedule:${b}`),
  );
  for (let week = 1; week <= 17; week++) {
    for (let i = 0; i < 16; i++) {
      const pair = [rotation[i], rotation[31 - i]];
      if (week % 2) pair.reverse();
      simulateGame(
        {
          id: `${week}-${i}`,
          week,
          homeTeam: pair[0],
          awayTeam: pair[1],
          seasonType: 'REG',
          played: false,
          homeScore: null,
          awayScore: null,
          winner: null,
        },
        teams,
        seed,
      );
    }
    rotation.splice(1, 0, rotation.pop()!);
  }
  return teams;
}

test('season calibration: elite, middle, and low OVR teams separate with meaningful variance', () => {
  const totals = { top: 0, middle: 0, bottom: 0, middleInRange: 0, topEight: 0 };
  const middleRecords = new Set<number>();
  for (let i = 0; i < 400; i++) {
    const teams = season(`balance-${i}`);
    const ranked = Object.values(teams).sort((a, b) => b.record.wins - a.record.wins);
    totals.top += teams.T31.record.wins;
    totals.bottom += teams.T0.record.wins;
    totals.middle += teams.T16.record.wins;
    if (teams.T16.record.wins >= 6 && teams.T16.record.wins <= 10) totals.middleInRange++;
    if (ranked.slice(0, 8).some((t) => t.abbr === 'T31')) totals.topEight++;
    middleRecords.add(teams.T16.record.wins);
    assert.equal(
      Object.values(teams).reduce((s, t) => s + t.record.wins, 0),
      272,
    );
  }
  const report = {
    eliteWins: totals.top / 400,
    middleWins: totals.middle / 400,
    lowWins: totals.bottom / 400,
    middleSixToTenRate: totals.middleInRange / 400,
    eliteTopEightRate: totals.topEight / 400,
  };
  console.log('400-season calibration', report);
  assert.ok(report.eliteWins >= 12 && report.eliteWins <= 15);
  assert.ok(report.middleWins >= 7 && report.middleWins <= 10);
  assert.ok(report.lowWins >= 2 && report.lowWins <= 5);
  assert.ok(report.middleSixToTenRate >= 0.7);
  assert.ok(report.eliteTopEightRate >= 0.8);
  assert.ok(middleRecords.size >= 5);
});

test('changing OVR improves or lowers future results under identical schedules and seeds', () => {
  let low = 0,
    medium = 0,
    high = 0;
  for (let i = 0; i < 200; i++) {
    low += season(`upgrade-${i}`, 70).T16.record.wins;
    medium += season(`upgrade-${i}`, 80).T16.record.wins;
    high += season(`upgrade-${i}`, 90).T16.record.wins;
  }
  assert.ok(medium - low > 400);
  assert.ok(high - medium > 400);
});

test('probabilities are symmetric at neutral sites, monotonic, and allow upsets', () => {
  assert.equal(franchiseHomeWinChance(80, 80, true), 0.5);
  assert.ok(franchiseHomeWinChance(80, 80) > 0.5);
  for (let ovr = 60; ovr < 99; ovr++)
    assert.ok(franchiseHomeWinChance(ovr + 1, 80, true) >= franchiseHomeWinChance(ovr, 80, true));
  assert.ok(franchiseHomeWinChance(99, 60, true) < 1);
  assert.ok(franchiseHomeWinChance(60, 99, true) > 0);
});
