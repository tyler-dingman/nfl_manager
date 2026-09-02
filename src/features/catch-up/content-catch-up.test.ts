import assert from 'node:assert/strict';
import test from 'node:test';

import type { TeamBriefing } from '@/features/content/types';
import { buildContentCatchUpItems } from './engine';

const briefing = (id: string, updatedAt: string): TeamBriefing => ({
  id,
  teamAbbr: 'KC',
  category: 'Team news',
  headline: `Headline ${id}`,
  summary: `Summary ${id}`,
  updatedAt,
  sourceCount: 1,
  sources: [
    {
      id: `source-${id}`,
      kind: 'reporting',
      publisher: 'Test publisher',
      title: `Source ${id}`,
      url: 'https://example.com',
      publishedAt: updatedAt,
    },
  ],
});

test('returns only content published after the cross-device baseline', () => {
  const items = buildContentCatchUpItems({
    teamId: 'KC',
    baselineAt: '2026-08-31T14:00:00.000Z',
    briefings: [
      briefing('old', '2026-08-31T13:59:00.000Z'),
      briefing('new-1', '2026-08-31T15:00:00.000Z'),
      briefing('new-2', '2026-08-31T16:00:00.000Z'),
    ],
    consumedVersions: new Map(),
  });
  assert.deepEqual(
    items.map((item) => item.storyId),
    ['new-2', 'new-1'],
  );
});

test('excludes a consumed version but includes a materially newer version of the same item', () => {
  const current = briefing('story', '2026-08-31T16:00:00.000Z');
  assert.equal(
    buildContentCatchUpItems({
      teamId: 'KC',
      baselineAt: '2026-08-31T14:00:00.000Z',
      briefings: [current],
      consumedVersions: new Map([['story', current.updatedAt]]),
    }).length,
    0,
  );
  assert.equal(
    buildContentCatchUpItems({
      teamId: 'KC',
      baselineAt: '2026-08-31T14:00:00.000Z',
      briefings: [current],
      consumedVersions: new Map([['story', '2026-08-31T15:00:00.000Z']]),
    }).length,
    1,
  );
});
