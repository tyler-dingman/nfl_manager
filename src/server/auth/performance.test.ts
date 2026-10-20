import test from 'node:test';
import assert from 'node:assert/strict';
import { authStage, authStageSync, withAuthTimings, type AuthTiming } from './performance';
import { applicationEnvironment, withApplicationBindings } from '../persistence/bindings';
import { requireAuthConfig } from './config';
test('timings are bounded, numeric, failure-aware and isolated across concurrent requests', async () => {
  const a: AuthTiming[] = [],
    b: AuthTiming[] = [];
  await Promise.all([
    withAuthTimings(a, async () => {
      await authStage('session.lookup', async () => {});
      assert.throws(() =>
        authStageSync('json.serialization', () => {
          throw Error('must not be logged');
        }),
      );
    }),
    withAuthTimings(b, async () => {
      for (let i = 0; i < 100; i++) await authStage('jwt.claims', () => {});
    }),
  ]);
  assert.equal(a.length, 2);
  assert.equal(a[1].ok, false);
  assert.equal(b.length, 96);
  for (const row of [...a, ...b]) {
    assert.deepEqual(Object.keys(row).sort(), ['elapsedMs', 'ok', 'stage']);
    assert(row.elapsedMs >= 0);
  }
});
test('configuration snapshots never cross request boundaries even when binding input is reused', async () => {
  const binding = {
    db: {} as any,
    objects: {} as any,
    env: {
      APP_DATA_BACKEND: 'd1',
      AUTH_JWT_SECRET: 'synthetic-request-secret-a-at-least-32-characters',
    },
  };
  await withApplicationBindings(binding, async () => {
    assert.strictEqual(applicationEnvironment(), applicationEnvironment());
    assert(Object.isFrozen(applicationEnvironment()));
    assert.equal(requireAuthConfig().AUTH_JWT_SECRET, binding.env.AUTH_JWT_SECRET);
  });
  binding.env.AUTH_JWT_SECRET = 'synthetic-request-secret-b-at-least-32-characters';
  await withApplicationBindings(binding, async () =>
    assert.equal(requireAuthConfig().AUTH_JWT_SECRET, binding.env.AUTH_JWT_SECRET),
  );
});
