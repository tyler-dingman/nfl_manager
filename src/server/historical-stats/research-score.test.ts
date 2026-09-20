import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateResearchScore, directionalMatchup } from './research-score';
import { calculatePlayerPropTrend } from './trend-service';
import { calculateOpponentVsPosition } from './opponent-vs-position-service';
import { evaluatePropSides } from './prop-side-research-service';
import type { HistoricalPlayerGame, TeamSeasonStrength, HistoricalStatType } from './types';
const strength = (rank: number): TeamSeasonStrength => ({
  season: 2025,
  teamId: 'WAS',
  passDefenseRank: rank,
  rushDefenseRank: rank,
  scoringDefenseRank: rank,
  totalDefenseRank: rank,
  passingYardsAllowedPerGame: 240,
  rushingYardsAllowedPerGame: 130,
  pointsAllowedPerGame: 25,
  totalYardsAllowedPerGame: 370,
});
const games = (values = [12, 1, 9, 8, 4, 6, 4, 0, 5, 12]): HistoricalPlayerGame[] =>
  values.map((v, i) => ({
    playerId: 'p',
    playerName: 'Player',
    position: 'RB',
    gameId: String(i),
    season: 2025,
    seasonType: 'REG',
    week: i + 1,
    date: `2025-12-${String(20 - i).padStart(2, '0')}`,
    teamId: 'DAL',
    opponentTeamId: 'WAS',
    homeAway: 'HOME',
    passingAttempts: 30,
    passingCompletions: 20,
    passingYards: v,
    passingTds: 1,
    interceptions: 0,
    carries: v,
    rushingYards: v,
    rushingTds: 0,
    targets: 5,
    receptions: 3,
    receivingYards: v,
    receivingTds: 0,
  }));
const input = {
  playerId: 'p',
  statType: 'RUSHING_ATTEMPTS' as const,
  line: 17.5,
  side: 'UNDER' as const,
  position: 'RB',
  lineType: 'main' as const,
};
test('rank extremes reverse with side; middle ranks are neutral and continuous', () => {
  for (const [stat, position] of [
    ['RUSHING_YARDS', 'RB'],
    ['PASSING_YARDS', 'QB'],
    ['RECEIVING_YARDS', 'WR'],
  ] as const) {
    for (const rank of [1, 8, 16, 17, 25, 32]) {
      const over = directionalMatchup(stat, 'OVER', { position, strength: strength(rank) }),
        under = directionalMatchup(stat, 'UNDER', { position, strength: strength(rank) });
      assert.equal(over.adjustment, -under.adjustment);
      if (rank === 16 || rank === 17) assert.equal(over.alignment, 'neutral');
    }
    assert.equal(
      directionalMatchup(stat, 'UNDER', { position, strength: strength(32) }).alignment,
      'conflicts',
    );
    assert.equal(
      directionalMatchup(stat, 'UNDER', { position, strength: strength(1) }).alignment,
      'supports',
    );
  }
});
test('unsupported metrics, mismatched position, and missing/invalid rank have no adjustment', () => {
  for (const stat of [
    'INTERCEPTIONS',
    'PASSING_TDS',
    'RUSHING_TDS',
    'RECEIVING_TDS',
    'RECEPTIONS',
    'ANYTIME_TD',
    'PASSING_RUSHING_YARDS',
    'RUSH_RECEIVE_YARDS',
    'RUSHING_RECEIVING_YARDS',
  ] as HistoricalStatType[]) {
    assert.equal(
      directionalMatchup(stat, 'UNDER', { position: 'RB', strength: strength(32) }).alignment,
      'unknown',
    );
  }
  for (const rank of [0, 33, NaN])
    assert.equal(
      directionalMatchup('RUSHING_YARDS', 'OVER', { position: 'RB', strength: strength(rank) })
        .adjustment,
      0,
    );
  assert.equal(
    directionalMatchup('RUSHING_YARDS', 'OVER', { position: 'QB', strength: strength(32) })
      .alignment,
    'unknown',
  );
  assert.equal(
    calculateResearchScore(games(), input).score,
    calculateResearchScore(games(), { ...input, strength: null }).score,
  );
});
test('Javonte-style Under has conflicting matchup and contextual elevated line, not extra support', () => {
  const r = calculateResearchScore(games(), { ...input, strength: strength(32) });
  assert.equal(r.lineContext.baseline, 6.1);
  assert.equal(r.lineContext.lineDelta, 11.4);
  assert.equal(r.matchup.label, 'Works Against Under');
  assert.equal(r.lineContext.consistentWithMatchup, true);
  assert.equal(r.matchup.adjustment, -3);
  assert.ok(r.score < calculateResearchScore(games(), { ...input, strength: strength(1) }).score);
  assert.ok(
    Math.abs(r.matchup.adjustment) <
      Math.abs(
        directionalMatchup('RUSHING_YARDS', 'UNDER', { position: 'RB', strength: strength(32) })
          .adjustment,
      ),
  );
});
test('one/two-game perfect samples cannot equal a ten-game perfect sample', () => {
  const score = (n: number) => calculateResearchScore(games(Array(n).fill(6)), input).score;
  assert.ok(score(1) < score(2));
  assert.ok(score(2) < score(10));
  assert.equal(calculateResearchScore([], input).breakdown.sampleQuality.reliability, 0);
});
test('alt-line saturation: easier thresholds keep selected stats but do not raise main-anchored score', () => {
  const logs = games([251, 428, 356, 309, 369, 271, 252, 412, 277, 254]).map((g) => ({
    ...g,
    position: 'QB',
  }));
  const scores = [150.5, 160.5, 170.5, 180.5, 190.5, 200.5, 210.5, 220.5].map((line) =>
    calculatePlayerPropTrend(logs, {
      ...input,
      statType: 'PASSING_YARDS',
      position: 'QB',
      side: 'OVER',
      line,
      lineType: 'alternate',
      mainLine: 285.5,
    }),
  );
  assert.equal(new Set(scores.map((t) => t.trendScore)).size, 1);
  assert.equal(scores[0]!.last10.hits, 10);
  assert.equal(scores[0]!.researchScore.lineContext.scoringLine, 285.5);
  assert.ok(scores[0]!.trendScore < 90);
  const unknown = calculateResearchScore(logs, {
    ...input,
    statType: 'PASSING_YARDS',
    position: 'QB',
    side: 'OVER',
    line: 150.5,
    lineType: 'alternate',
    mainLine: null,
  });
  assert.match(unknown.lineContext.scoreBasis, /Unverified/);
  assert.ok(unknown.score < 90);
});
test('usage and stored spread signals invert for Under; unknown script is neutral', () => {
  const logs = games([12, 12, 12, 12, 12, 6, 6, 6, 6, 6]);
  const under = calculateResearchScore(logs, { ...input, spread: -7 }),
    over = calculateResearchScore(logs, { ...input, side: 'OVER', spread: -7 });
  assert.equal(under.breakdown.usage.adjustment, -over.breakdown.usage.adjustment);
  assert.equal(under.breakdown.gameContext.adjustment, -over.breakdown.gameContext.adjustment);
  assert.equal(under.breakdown.gameContext.alignment, 'conflicts');
  assert.equal(calculateResearchScore(logs, input).breakdown.gameContext.alignment, 'unknown');
});
test('position-opponent hit rates use the selected side', () => {
  const logs = games([300, 290, 280, 270, 260, 255, 252, 251, 200, 210]).map((g) => ({
    ...g,
    position: 'QB',
  }));
  assert.equal(
    calculateOpponentVsPosition(logs, 'QB', 'PASSING_YARDS', 250.5, 'OVER').last10.hits,
    8,
  );
  assert.equal(
    calculateOpponentVsPosition(logs, 'QB', 'PASSING_YARDS', 250.5, 'UNDER').last10.hits,
    2,
  );
});
test('Lab Find uses the same score and does not count correlated history as independent groups', () => {
  const context = { position: 'RB', lineType: 'main' as const, strength: strength(32) };
  const result = evaluatePropSides(
    { playerId: 'p', marketType: 'RUSHING_ATTEMPTS', line: 17.5, side: 'UNDER' },
    games(),
    'WAS',
    context,
  );
  assert.equal(
    result.under?.internalScore,
    calculateResearchScore(games(), { ...input, ...context }).score,
  );
  assert.ok(result.under!.concerns.some((c) => c.value === 'Works Against Under'));
});
