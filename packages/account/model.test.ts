import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAccountData, accountMutation } from './model';
test('optional crew failure does not discard real profile overview data', async () => {
  const data = await loadAccountData(async (path) => {
    if (path === '/api/crew') throw Error('missing crew schema');
    return Response.json(
      path.includes('/stats')
        ? { stats: { lifetimePoints: 25 } }
        : path.includes('leaderboard')
          ? { rows: [{ userId: 'me', rank: 3 }] }
          : path.includes('preferences')
            ? { preferences: { emailEnabled: false } }
            : path.includes('identities')
              ? { identities: [] }
              : { providers: { google: true } },
    );
  }, 'me');
  assert.equal(data.points, 25);
  assert.equal(data.rank, 3);
  assert.equal(data.crew, null);
  assert.equal(data.preferences?.emailEnabled, false);
  assert.equal(data.providers.google, true);
});
test('mutation rejects server errors and preserves false preference values', async () => {
  await assert.rejects(
    accountMutation(
      async () => Response.json({ error: 'Save failed' }, { status: 400 }),
      '/profile',
      'PATCH',
      {},
    ),
    /Save failed/,
  );
  await accountMutation(
    async (_url, init) => {
      assert.deepEqual(JSON.parse(String(init?.body)), { emailEnabled: false });
      return Response.json({ ok: true });
    },
    '/preferences',
    'PATCH',
    { emailEnabled: false },
  );
});
