import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGeneratorRequest,
  generateConstrainedParlay,
  type GeneratorCandidate,
} from './generator';
import { estimateParlayOdds } from '@/components/parlay-lab/parlay-odds';
const games = Array.from({ length: 5 }, (_, i) => ({
  id: `g${i}`,
  homeTeamId: 'KC',
  awayTeamId: 'BUF',
  kickoffAt: '2099-10-01T23:00:00Z',
}));
const candidates = Array.from({ length: 6 }, (_, i) => ({
  id: `p${i}`,
  playerId: `p${i}`,
  eventId: `g${i % 5}`,
  playerName: i === 0 ? 'Patrick Mahomes' : `Player ${i}`,
  position: i === 0 ? 'QB' : 'RB',
  teamId: i === 0 ? 'KC' : 'BUF',
  marketType: 'RUSHING_YARDS',
  statId: 'rushing_yards',
  side: 'OVER',
  line: 50.5,
  sportsbook: 'FANDUEL',
  odds: -110,
  available: true,
  period: 'game',
  deeplink: null,
  trend: { trendScore: 95 - i * 3, sampleConfidence: 'HIGH', last10: { games: 10, hits: 8 } },
})) as GeneratorCandidate[];
test('exact requested example parses count, target odds and minimum score; emits stored legs', () => {
  const rules = parseGeneratorRequest(
    '4 leg parlay with -200 odds and all legs 80 Lab Score or higher',
    candidates,
  );
  assert.equal(rules.legs, 4);
  assert.equal(rules.targetOdds, -200);
  assert.equal(rules.minScore, 80);
  const result = generateConstrainedParlay(candidates, games, rules);
  assert.equal(result.legs.length, 4);
  assert.ok(result.legs.every((m) => candidates.includes(m) && m.trend!.trendScore >= 80));
  assert.equal(estimateParlayOdds(result.legs.map((m) => m.odds)), 1228);
});
test('score-only numbers do not become leg counts and favorite team resolves', () => {
  assert.equal(parseGeneratorRequest('80+ Lab Scores only', candidates).legs, 3);
  assert.deepEqual(parseGeneratorRequest('Build around my team', candidates, 'ARI').teams, ['ARI']);
});
test('different games, required player, and no TD constraints are hard', () => {
  const rules = parseGeneratorRequest(
    '5 legs from 5 different games without touchdown props build around Mahomes',
    candidates,
  );
  const result = generateConstrainedParlay(candidates, games, rules);
  assert.equal(result.legs.length, 5);
  assert.equal(new Set(result.legs.map((m) => m.eventId)).size, 5);
  assert.ok(result.legs.some((m) => m.playerName === 'Patrick Mahomes'));
  const impossible = generateConstrainedParlay(candidates, games, { ...rules, minScore: 99 });
  assert.equal(impossible.legs.length, 0);
  assert.match(impossible.message, /Only 0/);
});
test('refinements retain prior constraints and exclude TD props; missing lines and locked games excluded', () => {
  const base = parseGeneratorRequest('3 legs all Lab Scores at least 80', candidates);
  const refined = parseGeneratorRequest('Remove touchdown props', candidates, undefined, base);
  assert.equal(refined.legs, 3);
  assert.equal(refined.minScore, 80);
  assert.equal(refined.noTD, true);
  assert.equal(refined.tdOnly, false);
  const invalid = candidates.map((m) => ({ ...m, available: false }));
  assert.equal(generateConstrainedParlay(invalid, games, refined).legs.length, 0);
  assert.equal(
    generateConstrainedParlay(
      candidates,
      games.map((g) => ({ ...g, marketsLocked: true })),
      refined,
    ).legs.length,
    0,
  );
});
test('same-game requests cannot mix named teams from different matchups', () => {
  const rules = parseGeneratorRequest('2 leg same game parlay Chiefs Dolphins', candidates);
  assert.equal(generateConstrainedParlay(candidates, games, rules).legs.length, 0);
});

test('replacement requires a WR and excludes TE while preserving other positions', () => {
  const prior = parseGeneratorRequest('3 legs minimum Lab Score 80', candidates);
  const rules = parseGeneratorRequest('Replace the TE with a WR', candidates, undefined, prior);
  assert.deepEqual(rules.positions, []);
  assert.equal(rules.requiredPosition, 'WR');
  assert.deepEqual(rules.excludePositions, ['TE']);
  const pool = candidates.map((m, i) => ({
    ...m,
    position: i === 1 ? 'WR' : i === 2 ? 'TE' : m.position,
  }));
  const result = generateConstrainedParlay(pool, games, rules);
  assert.equal(result.legs.length, 3);
  assert.ok(result.legs.some((m) => m.position === 'WR'));
  assert.ok(result.legs.every((m) => m.position !== 'TE'));
});
test('target odds break equal-quality ties using existing combined-odds math', () => {
  const pool = candidates
    .slice(0, 3)
    .map((m, i) => ({ ...m, odds: i === 2 ? -300 : -110, trend: { ...m.trend!, trendScore: 90 } }));
  const rules = parseGeneratorRequest('2 legs around +150 odds', pool);
  const result = generateConstrainedParlay(pool, games, rules);
  assert.ok(result.legs.some((m) => m.odds === -300));
});
