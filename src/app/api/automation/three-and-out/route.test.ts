import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from './route';

test('Three & Out still authenticates before handling actions', async () => {
  const original = process.env.CONTENT_AUTOMATION_SECRET;
  const previous = process.env.CONTENT_AUTOMATION_PREVIOUS_SECRET;
  process.env.CONTENT_AUTOMATION_SECRET = 'test-current';
  process.env.CONTENT_AUTOMATION_PREVIOUS_SECRET = 'test-previous';
  const request = (authorization?: string) =>
    new NextRequest('https://example.com/api/automation/three-and-out?action=unknown', {
      method: 'POST',
      headers: authorization ? { authorization } : {},
    });
  try {
    for (const token of [undefined, 'Bearer wrong']) {
      const response = await POST(request(token));
      assert.equal(response.status, 401);
      assert.equal((await response.json()).code, 'automation-unauthorized');
    }
    for (const token of ['test-current', 'test-previous']) {
      const response = await POST(request(`Bearer ${token}`));
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, 'Unknown action');
    }
    delete process.env.CONTENT_AUTOMATION_SECRET;
    assert.equal((await POST(request('Bearer test-previous'))).status, 503);
  } finally {
    if (original === undefined) delete process.env.CONTENT_AUTOMATION_SECRET;
    else process.env.CONTENT_AUTOMATION_SECRET = original;
    if (previous === undefined) delete process.env.CONTENT_AUTOMATION_PREVIOUS_SECRET;
    else process.env.CONTENT_AUTOMATION_PREVIOUS_SECRET = previous;
  }
});
