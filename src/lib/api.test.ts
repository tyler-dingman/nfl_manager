import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiFetch } from './api';

test('API requests preserve JSON responses, including server errors', async (t) => {
  const response = Response.json({ error: 'Save not found.' }, { status: 404 });
  t.mock.method(globalThis, 'fetch', async () => response);
  const result = await apiFetch('/front-office/simulate?saveId=private-save');
  assert.equal(result, response);
  assert.deepEqual(await result.json(), { error: 'Save not found.' });
});

test('HTML server errors identify the endpoint without leaking query or body', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response('<!DOCTYPE html>private-body', {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
  );
  await assert.rejects(apiFetch('/front-office/simulate?saveId=private-save'), (error: Error) => {
    assert.match(error.message, /server could not complete/);
    assert.match(error.message, /\/api\/front-office\/simulate, HTTP 500/);
    assert.doesNotMatch(error.message, /private-save|private-body|Unexpected token/);
    return true;
  });
});

test('HTML redirects explain how to recover an expired session', async (t) => {
  const response = new Response('<!DOCTYPE html>', { headers: { 'Content-Type': 'text/html' } });
  Object.defineProperty(response, 'redirected', { value: true });
  t.mock.method(globalThis, 'fetch', async () => response);
  await assert.rejects(apiFetch('/front-office/events'), /Refresh and sign in again/);
});
