import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness';
import { NOW, publishFixture, source, video } from './fixtures';
import { TEAM_IDS } from '../src/teams';
test('shared national stories, multi-team Film Room and published editions serve every NFL team', async () => {
  const h = await harness();
  try {
    await h.repo.upsertSource(source('source-1', null));
    for (let i = 0; i < 3; i++) await publishFixture(h.repo, `coverage-national-${i}`, null);
    await h.repo.upsertVideo(video('shared-all-teams', [...TEAM_IDS]));
    for (const t of TEAM_IDS) {
      assert.equal((await h.repo.sourcesForTeam(t)).length, 1);
      assert.equal((await h.repo.storiesForTeam(t)).items.length, 3);
      assert.equal((await h.repo.videosForTeam(t)).items[0].videoId, 'shared-all-teams');
      const edition = {
        id: `coverage-edition-${t}`,
        teamId: t,
        briefingDate: '2027-01-15',
        status: 'PUBLISHED' as const,
        generatedAt: NOW,
        sourceFingerprint: 'coverage',
        items: [0, 1, 2].map((i) => ({ storyId: `coverage-national-${i}` })),
      };
      await h.repo.saveEdition(edition);
      assert.deepEqual((await h.repo.editionsForTeam(t)).items[0], edition);
    }
    for (let i = 0; i < 2; i++)
      await h.repo.saveEdition({
        id: `legacy-null-date-${i}`,
        teamId: 'kc',
        briefingDate: null,
        status: 'PUBLISHED',
        generatedAt: NOW + 10 + i,
        sourceFingerprint: `null-${i}`,
        items: [0, 1, 2].map((i) => ({ storyId: `coverage-national-${i}` })),
      });
    const seen: string[] = [];
    let cursor: import('../src/types').Cursor | undefined;
    do {
      const page = await h.repo.editionsForTeam('kc', 1, cursor);
      seen.push(...page.items.map((e) => e.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    assert.equal(new Set(seen).size, 3);
    assert.deepEqual(seen, ['legacy-null-date-1', 'legacy-null-date-0', 'coverage-edition-kc']);
  } finally {
    await h.close();
  }
});
