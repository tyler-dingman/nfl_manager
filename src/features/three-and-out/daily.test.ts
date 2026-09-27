import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDailyBriefingPush,
  dateInTimezone,
  isDailyBriefingDeliveryDue,
  dailyBriefingDeliveryDate,
  selectDailyBriefingStories,
} from './daily';
import type { ThreeAndOutStory } from './types';

const NOW = new Date('2026-09-09T21:00:00.000Z');
const story = (
  id: string,
  title: string,
  category: string,
  importanceScore: number,
  teamId = 'KC',
): ThreeAndOutStory =>
  ({
    id,
    teamId,
    title,
    shortTitle: title,
    summary: `${title} summary`,
    whyItMatters: 'It affects the team.',
    whatsNext: 'Watch for updates.',
    status: 'DEVELOPING',
    importanceScore,
    scoreSignals: {},
    previousRank: null,
    currentRank: 0,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    firstPublishedAt: NOW.toISOString(),
    lastMaterialUpdateAt: NOW.toISOString(),
    sourceCount: 1,
    sources: [
      {
        id: `source-${id}`,
        storyId: id,
        sourceName: 'Team',
        authorName: null,
        sourceType: 'OFFICIAL',
        sourceUrl: `https://example.com/${id}`,
        publishedAt: NOW.toISOString(),
        isOriginalReporter: true,
        isOfficialSource: true,
      },
    ],
    videoStatus: 'NONE',
    category,
  }) as ThreeAndOutStory;

test('selects exactly three same-team stories with importance and category diversity', () => {
  const selected = selectDailyBriefingStories(
    [
      story('trade', 'Chiefs complete major roster trade', 'transaction', 99),
      story('injury', 'Starting tackle misses practice with injury', 'injury', 91),
      story('game', 'Chiefs prepare for Sunday matchup', 'game', 88),
      story('minor', 'Practice notes from Wednesday', 'team', 25),
      story('wrong-team', 'Bears make a move', 'transaction', 1000, 'CHI'),
    ],
    'KC',
    NOW,
  );
  assert.deepEqual(
    selected.map((item) => item.id),
    ['trade', 'injury', 'game'],
  );
  assert.ok(selected.every((item) => item.teamId === 'KC'));
});

test('clusters duplicate and multilingual headlines around the same named event', () => {
  const selected = selectDailyBriefingStories(
    [
      story('one', 'Patrick Mahomes contract extension update', 'contract', 100),
      story('duplicate', 'Actualización: extensión de contrato Patrick Mahomes', 'contract', 99),
      story('injury', 'Trent McDuffie injury update', 'injury', 80),
      story('game', 'Week 2 matchup preview', 'game', 70),
    ],
    'KC',
    NOW,
  );
  assert.equal(selected.length, 3);
  assert.equal(selected.filter((item) => item.title.includes('Mahomes')).length, 1);
});

test('builds a stable archived deep link and respects the local morning default', () => {
  const stories = [story('one', 'Trade completed', 'trade', 90)];
  const push = buildDailyBriefingPush({
    teamId: 'KC',
    teamName: 'Kansas City Chiefs',
    briefingDate: '2026-09-09',
    stories,
  });
  assert.equal(push.destination, '/three-and-out?team=KC&date=2026-09-09');
  assert.equal(push.title, 'THREE & OUT');
  assert.match(push.body, /3 things Kansas City Chiefs fans need to know today/);
  assert.equal(dateInTimezone(new Date('2026-09-09T22:05:00Z'), 'America/New_York'), '2026-09-09');
  assert.equal(
    isDailyBriefingDeliveryDue(new Date('2026-09-09T21:05:00Z'), 'America/New_York'),
    true,
  );
  assert.equal(
    isDailyBriefingDeliveryDue(new Date('2026-09-09T10:45:00Z'), 'America/New_York'),
    false,
  );
});

test('reserves first down for a completed game inside the postgame window', () => {
  const game = story('game-result', 'Chiefs defeat Broncos 31-10 in final score', 'game', 20);
  game.lastMaterialUpdateAt = '2026-09-09T12:00:00.000Z';
  const selected = selectDailyBriefingStories(
    [
      story('trade', 'Chiefs complete major roster trade', 'transaction', 99),
      story('injury', 'Starting tackle suffers season-ending injury', 'injury', 95),
      game,
      story('practice', 'Wednesday practice notes', 'practice', 90),
    ],
    'KC',
    NOW,
  );
  assert.equal(selected[0].id, 'game-result');
  assert.equal(selected.length, 3);
});

test('daily delivery follows local time across DST and fractional offsets', () => {
  for (const [date, zone, time, due] of [
    ['2026-01-10T12:59:00Z', 'America/Chicago', '07:00', false],
    ['2026-01-10T13:00:00Z', 'America/Chicago', '07:00', true],
    ['2026-07-10T12:00:00Z', 'America/Chicago', '07:00', true],
    ['2026-03-08T08:00:00Z', 'America/Chicago', '02:30', true],
    ['2026-11-01T06:30:00Z', 'America/Chicago', '01:30', true],
    ['2026-11-01T07:30:00Z', 'America/Chicago', '01:30', true],
    ['2026-07-10T01:15:00Z', 'Asia/Kathmandu', '07:00', true],
    ['2026-07-10T22:00:00Z', 'America/Chicago', '18:00', false],
    ['2026-07-11T04:59:00Z', 'America/Chicago', '23:59', true],
    ['2026-07-11T05:00:00Z', 'America/Chicago', '23:59', false],
    ['2026-07-10T12:00:00Z', 'Invalid/Timezone', '07:00', false],
  ] as const)
    assert.equal(isDailyBriefingDeliveryDue(new Date(date), zone, time), due, date + ' ' + zone);
});

test('late custom times remain deliverable across a delayed midnight poll', () => {
  assert.equal(
    dailyBriefingDeliveryDate(new Date('2026-07-11T05:04:00Z'), 'America/Chicago', '23:59'),
    '2026-07-10',
  );
  assert.equal(
    dailyBriefingDeliveryDate(new Date('2026-07-11T05:30:00Z'), 'America/Chicago', '23:59'),
    null,
  );
});
