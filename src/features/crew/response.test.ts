import assert from 'node:assert/strict';
import test from 'node:test';
import { readCrewResponse } from './response';
test('empty and HTML failures produce a useful Crew error', async () => {
  for (const body of ['', '<html>Server error</html>'])
    await assert.rejects(
      readCrewResponse(new Response(body, { status: 500 })),
      /The Crew is unavailable/,
    );
});
test('successful empty response is not mistaken for a user without a Crew', async () => {
  await assert.rejects(readCrewResponse(new Response('')), /incomplete response/);
  assert.deepEqual(await readCrewResponse(Response.json({ crew: null })), { crew: null });
});
test('preserves structured API errors and login guidance', async () => {
  await assert.rejects(
    readCrewResponse(Response.json({ error: 'Invite expired' }, { status: 400 })),
    /Invite expired/,
  );
  await assert.rejects(readCrewResponse(new Response('', { status: 401 })), /Sign in/);
});
