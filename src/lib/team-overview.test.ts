import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeTeamNeeds, type OverviewPlayer } from './team-overview';

const player = (
  position: string,
  rating: number,
  age: number,
  contractYearsRemaining: number,
): OverviewPlayer => ({ position, rating, age, contractYearsRemaining });

test('elite young starter with depth and contract stability is a low need', () => {
  const needs = analyzeTeamNeeds([player('QB', 92, 24, 4), player('QB', 72, 26, 2)]);
  const quarterback = needs.find((need) => need.position === 'QB');
  assert.ok(quarterback);
  assert.equal(quarterback.level, 'Low');
});

test('weak starters without depth on expiring deals create a high need', () => {
  const needs = analyzeTeamNeeds([player('LT', 61, 28, 1), player('RT', 63, 29, 1)]);
  const tackle = needs.find((need) => need.position === 'OT');
  assert.ok(tackle);
  assert.equal(tackle.level, 'High');
});

test('older strong starters with no depth and expiring deals retain future pressure', () => {
  const needs = analyzeTeamNeeds([player('EDGE', 88, 34, 1), player('EDGE', 84, 33, 1)]);
  const edge = needs.find((need) => need.position === 'EDGE');
  assert.ok(edge);
  assert.ok(edge.score >= 50);
});

test('need scores are finite and remain within the normalized range', () => {
  const needs = analyzeTeamNeeds([player('WR', 74, 27, 2)]);
  for (const need of needs) {
    assert.ok(Number.isFinite(need.score));
    assert.ok(need.score >= 0 && need.score <= 100);
  }
});

test('an obviously weaker position ranks ahead of a strong position group', () => {
  const needs = analyzeTeamNeeds([
    player('QB', 94, 25, 5),
    player('QB', 73, 26, 3),
    player('CB', 61, 29, 1),
  ]);
  const qb = needs.find((need) => need.position === 'QB');
  const cb = needs.find((need) => need.position === 'CB');
  assert.ok(qb && cb);
  assert.ok(cb.rank < qb.rank);
});
