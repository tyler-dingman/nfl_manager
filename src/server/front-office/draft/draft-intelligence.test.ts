import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWeeklyProspectRankings } from './draft-intelligence';
import type { DraftProspectRecord } from '@/server/data/draft-prospects';

const prospect = (id: string, rank: number): DraftProspectRecord => ({
  id,
  name: id,
  normalizedName: id,
  school: 'School',
  position: 'WR',
  ranking: rank,
  sourceRanks: { pff: null, espn: null, consensus: rank },
  averageRank: rank,
  confidence: 'medium',
  espnPlayerId: null,
  espnProfileUrl: null,
  headshotUrl: null,
  positionRank: null,
  age: 21,
  classYear: 'JR',
  height: '6-1',
  weight: 200,
  hometown: null,
  stats: {},
  summary: null,
  archetype: null,
  projectedRange: null,
  source: 'test',
  grade: String(90 - rank / 10),
  projectedPick: rank,
});
test('weekly prospect rankings are deterministic for a saved week', () => {
  const prospects = [prospect('A', 1), prospect('B', 12), prospect('C', 28)];
  assert.deepEqual(
    buildWeeklyProspectRankings({ prospects, seed: 'save', week: 8 }),
    buildWeeklyProspectRankings({ prospects, seed: 'save', week: 8 }),
  );
});
test('ranking trend matches movement from the prior ranking', () => {
  const ranked = buildWeeklyProspectRankings({
    prospects: [prospect('A', 34), prospect('B', 1), prospect('C', 2)],
    seed: 'rise',
    week: 8,
  });
  for (const entry of ranked) assert.equal(entry.rankingTrend, entry.priorRank - entry.currentRank);
});
