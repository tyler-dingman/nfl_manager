import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import webpush from 'web-push';
import { deliverWebPush, expiredWebPush, isPushEndpoint, webSubscriptionSchema } from './web-push';

const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
  format: 'jwk',
});
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/example',
  keys: {
    p256dh: Buffer.concat([
      Buffer.from([4]),
      Buffer.from(key.x!, 'base64url'),
      Buffer.from(key.y!, 'base64url'),
    ]).toString('base64url'),
    auth: Buffer.alloc(16).toString('base64url'),
  },
};

test('accepts browser services and valid keys; blocks arbitrary/internal destinations', () => {
  assert.equal(webSubscriptionSchema.safeParse(subscription).success, true);
  for (const endpoint of [
    'http://fcm.googleapis.com/a',
    'https://localhost/a',
    'https://127.0.0.1/a',
    'https://fcm.googleapis.com.evil.test/a',
    'https://fcm.googleapis.com:8443/a',
    'https://user@fcm.googleapis.com/a',
  ]) {
    assert.equal(isPushEndpoint(endpoint), false, endpoint);
  }
  assert.equal(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/test'), true);
  assert.equal(isPushEndpoint('https://web.push.apple.com/test'), true);
  assert.equal(
    webSubscriptionSchema.safeParse({ ...subscription, keys: { auth: 'bad', p256dh: 'bad' } })
      .success,
    false,
  );
});

test('only permanent expiration responses trigger subscription removal', () => {
  for (const statusCode of [404, 410]) assert.equal(expiredWebPush({ statusCode }), true);
  for (const statusCode of [400, 401, 403, 429, 500, 503])
    assert.equal(expiredWebPush({ statusCode }), false);
  assert.equal(expiredWebPush(new Error('network unavailable')), false);
});

test('passes VAPID to web-push and sends only notification payload', async (t) => {
  const env = { ...process.env };
  Object.assign(process.env, {
    WEB_PUSH_VAPID_PUBLIC_KEY: 'public',
    WEB_PUSH_VAPID_PRIVATE_KEY: 'private',
    WEB_PUSH_VAPID_SUBJECT: 'mailto:admin@example.com',
  });
  t.after(() => {
    process.env = env;
  });
  const send = t.mock.method(webpush, 'sendNotification', async () => ({ statusCode: 201 }));
  const message = {
    title: 'Down & Distance',
    body: 'Push notifications are working. 🏈',
    destination: '/',
    userId: 'private-user-id',
  };
  await deliverWebPush(JSON.stringify(subscription), message);
  const [sentSubscription, payload, options] = send.mock.calls[0].arguments as unknown as [
    unknown,
    string,
    { vapidDetails: { subject: string }; timeout: number },
  ];
  assert.deepEqual(sentSubscription, subscription);
  assert.deepEqual(JSON.parse(payload), {
    title: message.title,
    body: message.body,
    destination: '/',
  });
  assert.equal(options.vapidDetails.subject, 'mailto:admin@example.com');
  assert.equal(options.timeout, 10000);
  await assert.rejects(
    deliverWebPush(JSON.stringify({ ...subscription, expirationTime: 1 }), message),
    (error) => expiredWebPush(error),
  );
  assert.equal(send.mock.callCount(), 1);
});

test('worker displays push and keeps notification clicks on the app origin', async () => {
  const handlers: Record<string, (event: any) => void> = {};
  const shown: unknown[] = [];
  const opened: string[] = [];
  runInNewContext(readFileSync('public/push-sw.js', 'utf8'), {
    URL,
    self: {
      addEventListener: (name: string, fn: (event: any) => void) => {
        handlers[name] = fn;
      },
      location: { origin: 'https://example.com' },
      registration: {
        showNotification: async (...args: unknown[]) => {
          shown.push(args);
        },
      },
      clients: {
        matchAll: async () => [],
        openWindow: async (url: string) => {
          opened.push(url);
        },
      },
    },
  });
  let done: Promise<unknown> = Promise.resolve();
  const waitUntil = (promise: Promise<unknown>) => {
    done = promise;
  };
  handlers.push({
    data: {
      json: () => ({
        title: 'Down & Distance',
        body: 'Push notifications are working. 🏈',
        destination: '/',
      }),
    },
    waitUntil,
  });
  await done;
  assert.equal((shown[0] as unknown[])[0], 'Down & Distance');
  for (const destination of ['/three', 'https://evil.test/phishing']) {
    handlers.notificationclick({ notification: { close() {}, data: { destination } }, waitUntil });
    await done;
  }
  assert.deepEqual(opened, ['https://example.com/three', 'https://example.com/']);
});
