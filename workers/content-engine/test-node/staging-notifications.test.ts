import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../test/harness';
import { Storage, type SqlDatabase } from '../../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../../packages/storage/objects';
import { D1Notifications } from '../../../packages/storage/notifications';
test(
  'D1 notifications preserve ownership, deduplication, disabled-device isolation and full export',
  { timeout: 60000 },
  async () => {
    assert(!('DATABASE_URL' in process.env));
    assert(!('PRODUCTION_DATABASE_URL' in process.env));
    const h = await harness();
    try {
      const s = new Storage(
        h.binding as unknown as SqlDatabase,
        new PrivateObjects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket),
      );
      const n = new D1Notifications(s);
      for (const id of ['owner', 'other'])
        await s
          .statement(
            "INSERT INTO app_users(id,primary_email,status,created_at,updated_at) VALUES(?,?,'ACTIVE',1,1)",
            [id, id + '@example.invalid'],
          )
          .run();
      const device = await n.registerDevice('owner', {
        platform: 'IOS',
        installationId: 'original-installation',
      });
      assert(device);
      assert.equal(
        (
          await n.registerDevice('owner', {
            platform: 'IOS',
            installationId: 'original-installation',
          })
        )?.id,
        device.id,
      );
      const token = await n.upsertPushToken(
        'owner',
        device.id,
        'EXPO',
        'synthetic-private-push-token',
      );
      assert(token);
      assert.equal(await n.upsertPushToken('other', device.id, 'EXPO', 'attacker-token'), null);
      const stored = await s.rows<any>('SELECT token_ciphertext FROM app_push_tokens');
      assert(!stored[0].token_ciphertext.includes('synthetic-private-push-token'));
      assert.equal(
        (await n.listDeliverablePushTokens('owner'))[0].token,
        'synthetic-private-push-token',
      );
      await n.removeDevice('other', device.id);
      assert.equal((await n.listDevices('owner')).length, 1);
      await n.removeDevice('owner', device.id);
      assert.equal((await n.listDeliverablePushTokens('owner')).length, 0);
      for (let i = 0; i < 55; i++) {
        const row = await n.createNotification('owner', {
          eventId: 'original-event-' + i,
          title: 'Original title ' + i,
          body: 'Preserve source attribution',
          expiresAt: i < 2 ? new Date(1) : undefined,
        });
        assert(row);
        if (i < 2) await n.dismissNotification('owner', row.id);
      }
      assert.equal(
        await n.createNotification('owner', {
          eventId: 'original-event-0',
          title: 'duplicate',
          body: 'duplicate',
        }),
        null,
      );
      assert.equal((await n.exportNotifications('owner')).length, 55);
      assert.equal((await n.exportNotifications('other')).length, 0);
      assert.equal((await n.listInbox('owner', { limit: 50 })).length, 50);
      assert.equal(await n.unreadNotificationCount('owner'), 53);
      await n.markAllNotificationsRead('other');
      assert.equal(await n.unreadNotificationCount('owner'), 53);
      assert.equal((await s.rows('PRAGMA foreign_key_check')).length, 0);
    } finally {
      await h.close();
    }
  },
);
