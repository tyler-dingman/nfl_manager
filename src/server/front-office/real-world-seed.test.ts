import assert from 'node:assert/strict';
import test from 'node:test';

import { frontOfficeEventIncludesTeam } from '@/lib/front-office-league-news';
import { FRONT_OFFICE_2026_SEED, realWorldSeedEvents } from './real-world-seed';

const teams = [
  'ARI',
  'ATL',
  'BAL',
  'BUF',
  'CAR',
  'CHI',
  'CIN',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GB',
  'HOU',
  'IND',
  'JAX',
  'KC',
  'LV',
  'LAC',
  'LAR',
  'MIA',
  'MIN',
  'NE',
  'NO',
  'NYG',
  'NYJ',
  'PHI',
  'PIT',
  'SF',
  'SEA',
  'TB',
  'TEN',
  'WAS',
] as const;

test('the 2026 pre-Week 1 seed represents every NFL team', () => {
  assert.deepEqual(FRONT_OFFICE_2026_SEED.researchedTeamIds, [...teams].sort());
  for (const team of teams) {
    assert.ok(
      FRONT_OFFICE_2026_SEED.stories.some((story) => story.teamIds.includes(team)),
      `${team} has no associated seed story`,
    );
  }
});

test('the seed satisfies the league-wide editorial acceptance floor', () => {
  const stories = FRONT_OFFICE_2026_SEED.stories;
  assert.ok(stories.length >= 180 && stories.length <= 250);
  assert.ok(stories.some((story) => story.storyType === 'TRANSACTION'));
  assert.ok(stories.some((story) => story.storyType === 'INJURY'));
  assert.ok(stories.some((story) => story.storyType === 'CONTRACT'));
  assert.ok(stories.some((story) => story.storyType === 'RUMOR'));
  assert.ok(stories.some((story) => story.storyType === 'ANALYSIS'));
  assert.ok(stories.some((story) => story.tags.includes('TRADE')));
  assert.ok(stories.some((story) => story.tags.includes('DEPTH_CHART')));
  assert.ok(stories.some((story) => story.tags.includes('PRESEASON')));
});

test('seed stories are unique, sourced, and do not cross the cutoff', () => {
  const stories = FRONT_OFFICE_2026_SEED.stories;
  assert.equal(new Set(stories.map((story) => story.id)).size, stories.length);
  assert.equal(
    new Set(stories.map((story) => story.headline.toLowerCase().replace(/[^a-z0-9]/g, ''))).size,
    stories.length,
  );
  for (const story of stories) {
    assert.ok(story.publishedAt <= FRONT_OFFICE_2026_SEED.cutoff);
    assert.match(story.source.url, /^https:\/\//);
    assert.ok(story.teamIds.length > 0);
    assert.ok(!story.tags.includes('REGULAR_SEASON_RESULT'));
    assert.ok(!story.tags.includes('GAME_RECAP'));
  }
});

test('runtime events preserve provenance and remain idempotent by dedupe key', () => {
  const events = realWorldSeedEvents('acceptance-save', 2026);
  assert.equal(events.length, FRONT_OFFICE_2026_SEED.stories.length);
  assert.equal(new Set(events.map((event) => event.dedupeKey)).size, events.length);
  for (const event of events) {
    assert.equal(event.metadata.origin, 'REAL_WORLD_SEED');
    assert.equal(event.simulationPhase, 'preseason');
    assert.equal(event.simulationWeek, 1);
    assert.match(String(event.metadata.sourceUrl), /^https:\/\//);
  }
  assert.deepEqual(realWorldSeedEvents('acceptance-save', 2025), []);
});

test('runtime event IDs are stable within a save and unique across saves', () => {
  const first = realWorldSeedEvents('save-one', 2026);
  const repeated = realWorldSeedEvents('save-one', 2026);
  const second = realWorldSeedEvents('save-two', 2026);

  assert.deepEqual(
    first.map((event) => event.id),
    repeated.map((event) => event.id),
  );
  assert.equal(
    first.some((event, index) => event.id === second[index]?.id),
    false,
  );
});

test('every team receives populated My Team and Around the League views', () => {
  const events = realWorldSeedEvents('all-team-acceptance', 2026).map((event) => ({
    ...event,
    createdAt: String(event.metadata.sourcePublishedAt),
    updatedAt: String(event.metadata.sourcePublishedAt),
    surfacedAt: String(event.metadata.sourcePublishedAt),
    readAt: null,
    dismissedAt: null,
  }));
  for (const team of teams) {
    assert.ok(
      events.some((event) => frontOfficeEventIncludesTeam(event, team)),
      `${team} My Team is empty`,
    );
    assert.ok(
      events.some((event) => !frontOfficeEventIncludesTeam(event, team)),
      `${team} Around the League is empty`,
    );
  }
  for (const category of ['TRANSACTION', 'INJURY', 'CONTRACT', 'RUMOR']) {
    assert.ok(
      events.some((event) => event.metadata.newsCategory === category),
      `${category} view is empty`,
    );
  }
  assert.ok(events.some((event) => Number(event.metadata.importanceScore) > 0));
});
