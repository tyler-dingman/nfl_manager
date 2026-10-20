import test from 'node:test';
import assert from 'node:assert/strict';
import { multiHarness } from '../test/multi-harness';
import { MultiD1, TEAM_GROUPS } from '../../../packages/storage/multi-d1';
import { PublicEditorial } from '../../../packages/storage/editorial';
import { D1AuthRepository } from '../../../packages/storage/auth';
import {
  saveCrossShardContent,
  verifyCrossShardReferences,
} from '../../../packages/storage/cross-shard-saves';
import { lexicalSearch } from '../../../packages/storage/ai';
import { withApplicationBindings } from '../../../src/server/persistence/bindings';
import {
  getPublicStoryById,
  listPublicStories,
  listPublicStoryPage,
  listWireEntries,
} from '../../../src/server/story-engine/projections';
import { GET as feed } from '../../../src/app/api/content/huddle/route';

const view = (team: string) => ({
  id: 'original-global-fix-' + team,
  teamId: team,
  headline: team + ' synthetic editorial routing',
  shortSummary: 'Original identity preserved',
  whatHappened: 'Synthetic evidence only',
  whyItMatters: 'Routing regression',
  whatsNext: 'Hosted retest',
  status: 'DEVELOPING',
  storyType: 'ANALYSIS',
  importanceScore: 80,
  confidenceScore: 95,
  firstReportedAt: new Date().toISOString(),
  lastMeaningfulUpdateAt: new Date().toISOString(),
  sources: [
    {
      id: 'synthetic',
      name: 'Synthetic source',
      url: 'https://example.invalid/evidence',
      publishedAt: new Date().toISOString(),
      official: false,
      original: true,
    },
  ],
  primarySource: null,
  version: 1,
});

test(
  'all 32 team feeds plus NFL shared feed preserve original IDs, search, saved references and isolation',
  { timeout: 120000 },
  async () => {
    const h = await multiHarness();
    try {
      for (const team of [...TEAM_GROUPS.flat(), 'NFL']) {
        const router = new MultiD1(h.db),
          store = team === 'NFL' ? router.shared() : router.team(team);
        await new PublicEditorial(store).publish(view(team) as any, 'PUBLISHED');
      }
      const users = new D1AuthRepository(new MultiD1(h.db).users());
      const a = await users.createEmailUser({
        email: 'routing-a@example.invalid',
        passwordHash: 'unchanged-credential',
      });
      const b = await users.createEmailUser({
        email: 'routing-b@example.invalid',
        passwordHash: 'unchanged-credential',
      });
      assert(a && b);
      for (const team of [...TEAM_GROUPS.flat(), 'NFL']) {
        const router = new MultiD1(h.db);
        await withApplicationBindings(
          {
            db: h.db.D1_USERS,
            multiD1: router,
            objects: router.users().objects,
            env: { APP_DATA_BACKEND: 'd1' },
          },
          async () => {
            const expected = 'original-global-fix-' + team;
            assert.deepEqual(
              (await listPublicStories(team)).map((x) => x.id),
              [expected],
            );
            assert.equal(
              (await listPublicStoryPage(team, { page: 1, query: 'synthetic' })).stories[0].id,
              expected,
            );
            assert.deepEqual(await listWireEntries(team), []);
            const response = await feed(
              new Request('https://example.invalid/api/content/huddle?team=' + team),
            );
            assert.equal(response.status, 200);
            const body = await response.json();
            assert.equal(body.briefings[0].id, expected);
            assert.equal((await getPublicStoryById(expected))?.id, expected);
            assert(router.metrics.statements <= 50, 'entire read group remains bounded');
          },
        );
      }
      const router = new MultiD1(h.db);
      for (const team of ['NFL', 'KC', 'BUF']) {
        const saved = await saveCrossShardContent(router, a.id, {
          contentType: 'STORY',
          contentId: 'original-global-fix-' + team,
          title: 'Original title',
        });
        assert(saved);
      }
      await verifyCrossShardReferences(h.db);
      const refs = await h.db.D1_USERS.prepare(
        'SELECT owner,content_id,state FROM app_cross_shard_references WHERE user_id=?',
      )
        .bind(a.id)
        .all<any>();
      assert(
        refs.results.some(
          (x) => x.owner === 'D1_SHARED' && x.content_id.endsWith('NFL') && x.state === 'COMMITTED',
        ),
      );
      assert.equal(
        (
          await h.db.D1_USERS.prepare('SELECT count(*) n FROM app_saved_content WHERE user_id=?')
            .bind(b.id)
            .first<any>()
        )?.n,
        0,
      );
      assert(
        (await lexicalSearch(new MultiD1(h.db).team('KC'), 'synthetic', 'KC')).some(
          (x: any) => x.id === 'original-global-fix-KC',
        ),
      );
      const readRouter = new MultiD1(h.db);
      await withApplicationBindings(
        {
          db: h.db.D1_USERS,
          multiD1: readRouter,
          objects: readRouter.users().objects,
          env: { APP_DATA_BACKEND: 'd1' },
        },
        async () => {
          await assert.rejects(
            listPublicStoryPage('UNKNOWN', { page: 1 }),
            /canonical team|Unknown NFL/,
          );
        },
      );
    } finally {
      await h.close();
    }
  },
);
