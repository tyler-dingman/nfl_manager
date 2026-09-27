import assert from 'node:assert/strict';
import test from 'node:test';
import { sendPush, type PushMessage } from './push';

type Dependencies = NonNullable<Parameters<typeof sendPush>[1]>;
const message: PushMessage = {
  userId: 'user',
  title: 'Down & Distance',
  body: 'Push notifications are working. 🏈',
  destination: '/',
};
function fixture() {
  const deliveries: unknown[][] = [];
  const removed: string[] = [];
  const sent: string[] = [];
  let records = 0;
  const tokens = ['web1', 'web2', 'expo'].map((id) => ({
    id,
    deviceId: id,
    provider: id === 'expo' ? 'EXPO' : 'WEB_PUSH',
    token: id,
    tokenCiphertext: '',
  }));
  const dependencies: Dependencies = {
    getPreferences: async () =>
      ({ pushEnabled: true }) as Awaited<ReturnType<Dependencies['getPreferences']>>,
    listDeliverablePushTokens: async () => tokens,
    createNotification: async () => {
      records++;
      return { id: 'notification' };
    },
    recordDelivery: async (...args) => {
      deliveries.push(args);
    },
    deleteWebPushToken: async (_user, id) => {
      removed.push(id);
    },
    invalidatePushToken: async () => {},
    finishPushDelivery: async () => {},
    deliverWebPush: async (token) => {
      sent.push(token);
      return { statusCode: 201, body: '', headers: {} };
    },
    fetch: async () => {
      sent.push('expo');
      return new Response(JSON.stringify({ data: { status: 'ok', id: 'ticket' } }));
    },
  };
  return { dependencies, deliveries, removed, sent, records: () => records };
}

test('fans out one notification record to multiple browsers and Expo devices', async () => {
  const f = fixture();
  const result = await sendPush(message, f.dependencies);
  assert.equal(result.delivered, 3);
  assert.equal(f.records(), 1);
  assert.deepEqual(f.sent, ['web1', 'web2', 'expo']);
  assert.deepEqual(
    f.deliveries.map((row) => row[2]),
    ['WEB_PUSH', 'WEB_PUSH', 'EXPO'],
  );
});

test('browser test is scoped to a subscription belonging to the current user', async () => {
  const f = fixture();
  await sendPush({ ...message, webTokenId: 'web2' }, f.dependencies);
  assert.deepEqual(f.sent, ['web2']);
  const result = await sendPush({ ...message, webTokenId: 'another-users-token' }, f.dependencies);
  assert.equal(result.delivered, 0);
  assert.equal(f.records(), 1);
});

test('global push opt-out suppresses both providers and test delivery', async () => {
  const f = fixture();
  f.dependencies.getPreferences = async () =>
    ({ pushEnabled: false }) as Awaited<ReturnType<Dependencies['getPreferences']>>;
  const result = await sendPush(message, f.dependencies);
  assert.equal(result.delivered, 0);
  assert.equal(f.records(), 0);
  assert.deepEqual(f.sent, []);
});

test('expired browser tokens are deleted; transient failures retained; Expo still delivers', async () => {
  const f = fixture();
  f.dependencies.deliverWebPush = async (token) => {
    throw { statusCode: token === 'web1' ? 410 : 503 };
  };
  const result = await sendPush(message, f.dependencies);
  assert.equal(result.delivered, 1);
  assert.equal(result.failed, 2);
  assert.deepEqual(f.removed, ['web1']);
  assert.deepEqual(
    f.deliveries.map((row) => row[3]),
    ['FAILED', 'FAILED', 'SENT'],
  );
});
