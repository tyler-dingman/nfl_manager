import test from 'node:test';
import assert from 'node:assert/strict';
import { onboardingEntry } from '../lib/onboarding-policy';
import { createDemoSession } from '../lib/demo-session';
const input = {
  completed: false,
  step: 1,
  team: 'CHI',
  hasDeliveryRecord: false,
  createdAt: '2026-09-28T12:00:00Z',
};
test('missing favorite is required even on a completed profile', () =>
  assert.equal(onboardingEntry({ ...input, team: null, completed: true }), 1));
test('completed user bypasses setup', () =>
  assert.equal(onboardingEntry({ ...input, completed: true }), 0));
test('new user resumes each server cursor', () => {
  for (const step of [2, 3, 4, 5]) assert.equal(onboardingEntry({ ...input, step }), step);
  assert.equal(onboardingEntry(input), 2);
});
test('legacy users take shortest completion path', () => {
  const legacy = { ...input, createdAt: '2025-01-01' };
  assert.equal(onboardingEntry({ ...legacy, hasDeliveryRecord: true }), 0);
  assert.equal(onboardingEntry(legacy), 3);
  assert.equal(onboardingEntry({ ...legacy, step: 4 }), 4);
});
test('demo settings persist through logout and share canonical read contracts', async () => {
  const session = createDemoSession();
  session.login(true, 'test@gmail.com', 'test');
  const put = (path: string, body: unknown) =>
    session.respond(path, { method: 'PUT', body: JSON.stringify(body) });
  put('/api/user/team-follows/primary', { teamId: 'CHI' });
  put('/api/three-and-out/preferences', {
    enabled: true,
    email: true,
    deliveryTime: '09:15',
    timezone: 'America/Chicago',
  });
  put('/api/user/onboarding', { step: 4, completed: false });
  session.logout();
  session.login(true, 'test@gmail.com', 'test');
  assert.equal((await session.respond('/api/user/onboarding').json()).onboarding.step, 4);
  assert.equal(
    (await session.respond('/api/user/preferences').json()).preferences.preferredTeamId,
    'CHI',
  );
  assert.equal(
    (await session.respond('/api/three-and-out/preferences').json()).preferences.deliveryTime,
    '09:15',
  );
  assert.equal(session.respond('/api/commerce/checkout', { method: 'POST' }).status, 403);
});
