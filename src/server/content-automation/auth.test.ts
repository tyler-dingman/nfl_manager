import assert from 'node:assert/strict';
import test from 'node:test';
import { automationAuthError } from './auth';

test('missing and malformed primary credentials fail closed', () => {
  for (const secret of [undefined, '', ' ', 'token\n']) {
    assert.equal(
      automationAuthError('Bearer ', { CONTENT_AUTOMATION_SECRET: secret })?.status,
      503,
    );
  }
  assert.equal(
    automationAuthError('Bearer old', { CONTENT_AUTOMATION_PREVIOUS_SECRET: 'old' })?.status,
    503,
  );
});
test('only exact current or explicitly configured previous tokens authenticate', () => {
  const env = {
    CONTENT_AUTOMATION_SECRET: 'current',
    CONTENT_AUTOMATION_PREVIOUS_SECRET: 'previous',
  };
  assert.equal(automationAuthError('Bearer current', env), null);
  assert.equal(automationAuthError('Bearer previous', env), null);
  for (const token of [null, '', 'Bearer ', 'Bearer wrong', 'current', 'Bearer current '])
    assert.equal(automationAuthError(token, env)?.status, 401);
  assert.equal(
    automationAuthError('Bearer previous', { CONTENT_AUTOMATION_SECRET: 'current' })?.status,
    401,
  );
});
