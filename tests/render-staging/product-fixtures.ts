import { MultiD1, TEAM_GROUPS, teamDatabase } from '../../packages/storage/multi-d1';
import type { SqlDatabase } from '../../packages/storage/core';
import type { DatabaseOwner } from '../../packages/storage/multi-d1';
export async function seedStories(bindings: Record<DatabaseOwner, SqlDatabase>) {
  const now = Date.now(),
    iso = new Date(now).toISOString();
  let row = 900000;
  for (const team of [...TEAM_GROUPS.flat(), 'NFL']) {
    const owner = team === 'NFL' ? 'D1_SHARED' : teamDatabase(team),
      router = new MultiD1(bindings),
      s = router.storage(owner),
      id = 'render-fixture-' + team;
    const source = {
      id: 'synthetic-render-source',
      name: 'Synthetic fixture',
      url: 'https://example.invalid/fixture',
      publishedAt: iso,
      official: false,
      original: true,
    };
    const story = {
      id,
      teamId: team,
      headline: team + ' synthetic staging story',
      shortSummary: 'Synthetic only',
      whatHappened: 'Isolated local validation',
      whyItMatters: 'Tests routing',
      whatsNext: 'No live provider',
      status: 'DEVELOPING',
      storyType: 'ANALYSIS',
      importanceScore: 80,
      confidenceScore: 95,
      firstReportedAt: iso,
      lastMeaningfulUpdateAt: iso,
      sources: [source],
      primarySource: source,
      version: 1,
    };
    const hash = await s.put({ schema: 1, kind: 'PUBLIC_STORY', story, state: 'PUBLISHED' });
    await s.batch([
      s.statement(
        'INSERT INTO app_public_stories(id,search_rowid,team_id,story_type,importance,first_at,updated_at,evidence_at,version,visible,object_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        [id, row, team, 'ANALYSIS', 80, now, now, now, 1, 1, hash],
      ),
      s.statement('INSERT INTO app_public_story_versions VALUES(?,?,?)', [id, 1, hash]),
      s.statement(
        'INSERT INTO app_search(rowid,id,team_id,title,content,source_id,source_url) VALUES(?,?,?,?,?,?,?)',
        [
          row,
          id,
          team,
          story.headline,
          story.whatHappened,
          'synthetic-render-source',
          'https://example.invalid/fixture',
        ],
      ),
    ]);
    await new MultiD1(bindings)
      .shared()
      .statement('INSERT INTO app_editorial_directory(kind,id,owner) VALUES(?,?,?)', [
        'public',
        id,
        owner,
      ])
      .run();
    row++;
  }
}
