import test from 'node:test';
import assert from 'node:assert/strict';
import { accessApplication } from '../../scripts/prepare-staging-access.mjs';
const id = '11111111-1111-4111-8111-111111111111';
test('Access request protects the entire staging hostname including APIs/assets with named IdP identities', () => {
  const app = accessApplication(id, ['reviewer@example.invalid']);
  assert.equal(app.domain, 'down-distance-staging-web.tdingman5.workers.dev');
  assert.deepEqual(app.allowed_idps, [id]);
  assert.equal(app.policies.length, 1);
  assert.equal(app.policies[0].decision, 'allow');
  assert.deepEqual(app.policies[0].include, [{ email: { email: 'reviewer@example.invalid' } }]);
});
test('Access request rejects wildcard, empty and duplicate identity policies', () => {
  for (const emails of [
    [],
    ['*@example.invalid'],
    ['Everyone'],
    ['same@example.invalid', 'same@example.invalid'],
  ])
    assert.throws(() => accessApplication(id, emails));
});
