import test from 'node:test';
import assert from 'node:assert/strict';
import { assertAuthSecret } from './secret-policy';

test('auth rejects short or whitespace-padded signing secrets', () => {
  for (const secret of [undefined, '', 'a'.repeat(31), ` ${'a'.repeat(32)}`, `${'a'.repeat(32)} `])
    assert.throws(() => assertAuthSecret(secret));
  assert.doesNotThrow(() => assertAuthSecret('a'.repeat(32)));
});
