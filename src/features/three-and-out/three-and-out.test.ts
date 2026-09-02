import assert from 'node:assert/strict';
import test from 'node:test';

import { TEAM_LIST } from '@/data/teams';

import { getThreeAndOutPackage } from './data';
import { calculateImportanceScore, rankThreeAndOutStories } from './ranking';
import type { ThreeAndOutStory } from './types';

test('ranking weights follow the football-first 35/20/15/10/10/10 model', () => {
  assert.equal(
    calculateImportanceScore({
      footballImpact: 100,
      sourceStrength: 0,
      velocity: 0,
      freshness: 0,
      fanInterest: 0,
      novelty: 0,
    }),
    35,
  );
});

test('breaking news can immediately enter first down', () => {
  const data = getThreeAndOutPackage('KC');
  const stories: ThreeAndOutStory[] = data.current.stories.map((story) => ({
    ...story,
    status: 'HOLDING',
  }));
  stories[2] = { ...stories[2], status: 'BREAKING', importanceScore: 1 };
  assert.equal(rankThreeAndOutStories(stories)[0].id, stories[2].id);
});

test('all 32 teams receive exactly three ranked stories and two historical snapshots', () => {
  assert.equal(TEAM_LIST.length, 32);
  for (const team of TEAM_LIST) {
    const data = getThreeAndOutPackage(team.abbr);
    assert.equal(data.current.teamId, team.abbr);
    assert.equal(data.current.stories.length, 3);
    assert.deepEqual(
      data.current.stories.map((story) => story.currentRank),
      [1, 2, 3],
    );
    assert.equal(data.previous.length, 2);
    assert.ok(data.current.stories.every((story) => story.sources.length > 0));
  }
});
