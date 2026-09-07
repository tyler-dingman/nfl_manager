import assert from 'node:assert/strict';
import test from 'node:test';
import { VIDEO_SOURCE_CANDIDATES } from '@/data/sources/video/catalog';
import { classifyVideoTeamRelevance } from './video-relevance';

test('all 32 teams have official and Locked On candidates', () => {
  const teams = new Set(
    VIDEO_SOURCE_CANDIDATES.flatMap((source) => (source.teamId ? [source.teamId] : [])),
  );
  assert.equal(teams.size, 32);
  for (const teamId of teams) {
    const sources = VIDEO_SOURCE_CANDIDATES.filter((source) => source.teamId === teamId);
    assert.equal(sources.filter((source) => source.category === 'official').length, 1);
    assert.equal(sources.filter((source) => source.name.startsWith('Locked On ')).length, 1);
  }
});

test('active sources can never omit canonical channel identity', () => {
  for (const source of VIDEO_SOURCE_CANDIDATES.filter((source) => source.status === 'ACTIVE')) {
    assert.ok(source.youtubeChannelId);
    assert.ok(source.youtubeUrl);
  }
});

test('multi-team video requires explicit team evidence', () => {
  assert.equal(
    classifyVideoTeamRelevance({
      title: 'Weekly NFL roundup',
      teamId: 'KC',
      teamName: 'Kansas City Chiefs',
      multiTeam: true,
    }).accepted,
    false,
  );
  assert.equal(
    classifyVideoTeamRelevance({
      title: 'Chiefs offensive line film review',
      teamId: 'KC',
      teamName: 'Kansas City Chiefs',
      multiTeam: true,
    }).accepted,
    true,
  );
});

test('team source is a prior, not unconditional assignment', () => {
  assert.equal(
    classifyVideoTeamRelevance({
      title: 'General NFL news',
      teamId: 'CHI',
      teamName: 'Chicago Bears',
      sourceTeamId: 'CHI',
    }).accepted,
    false,
  );
});
