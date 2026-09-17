import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

test('preview gate lets automation reach route auth while protecting other routes', async () => {
  const previous = process.env.PRELAUNCH_MODE;
  process.env.PRELAUNCH_MODE = 'true';
  try {
    for (const path of [
      '/api/automation/content',
      '/api/automation/content/global',
      '/api/automation/three-and-out?action=generate',
      '/api/automation/three-and-out?action=deliver',
    ]) {
      const response = await middleware(
        new NextRequest(`https://example.com${path}`, { method: 'POST' }),
      );
      assert.equal(response.headers.get('x-middleware-next'), '1', path);
    }
    for (const path of [
      '/api/automation/unknown',
      '/api/automation/three-and-out/extra',
      '/api/front-office/events',
    ]) {
      const response = await middleware(new NextRequest(`https://example.com${path}`));
      assert.equal(response.status, 401, path);
      assert.equal((await response.json()).error, 'Private preview access required.');
    }
    const page = await middleware(new NextRequest('https://example.com/front-office'));
    assert.equal(new URL(page.headers.get('location')!).pathname, '/preview');
  } finally {
    if (previous === undefined) delete process.env.PRELAUNCH_MODE;
    else process.env.PRELAUNCH_MODE = previous;
  }
});
