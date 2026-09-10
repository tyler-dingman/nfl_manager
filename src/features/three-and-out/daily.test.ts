import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildDailyBriefingPush,
  dateInTimezone,
  isDailyBriefingDeliveryDue,
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
    audioStatus: 'NONE',
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
  assert.ok(selected.every((item) => item.teamId === 'KC' && item.audioStatus === 'DISABLED'));
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

test('builds a stable archived deep link and respects local 5 PM delivery', () => {
  const stories = [story('one', 'Trade completed', 'trade', 90)];
  const push = buildDailyBriefingPush({
    teamId: 'KC',
    teamName: 'Kansas City Chiefs',
    briefingDate: '2026-09-09',
    stories,
  });
  assert.equal(push.destination, '/three-and-out?team=KC&date=2026-09-09');
  assert.match(push.body, /5 PM briefing/);
  assert.equal(dateInTimezone(new Date('2026-09-09T22:05:00Z'), 'America/New_York'), '2026-09-09');
  assert.equal(
    isDailyBriefingDeliveryDue(new Date('2026-09-09T21:05:00Z'), 'America/New_York'),
    true,
  );
  assert.equal(
    isDailyBriefingDeliveryDue(new Date('2026-09-09T20:45:00Z'), 'America/New_York'),
    false,
  );
});

test('audio remains preserved but disabled and absent from primary UI', () => {
  const route = readFileSync('src/app/api/three-and-out/audio/route.ts', 'utf8');
  const page = readFileSync('src/components/three-and-out/three-and-out-experience.tsx', 'utf8');
  assert.match(route, /THREE_AND_OUT_AUDIO_ENABLED/);
  assert.doesNotMatch(page, /ThreeAndOutAudioPlayer/);
});
