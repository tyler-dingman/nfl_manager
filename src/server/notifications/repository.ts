import { randomUUID } from 'node:crypto';

import { authDb } from '@/server/auth/database';
import { decryptSecret, encryptSecret, tokenHash } from '@/server/auth/crypto';

export async function registerDevice(
  userId: string,
  input: {
    platform: 'IOS' | 'ANDROID' | 'WEB';
    deviceName?: string | null;
    appVersion?: string | null;
    osVersion?: string | null;
    installationId: string;
  },
) {
  const rows = await authDb()<Array<{ id: string }>>`
    INSERT INTO user_devices (id, user_id, platform, device_name, app_version, os_version, installation_id, last_seen_at)
    VALUES (${randomUUID()}, ${userId}, ${input.platform}, ${input.deviceName ?? null}, ${input.appVersion ?? null}, ${input.osVersion ?? null}, ${input.installationId}, now())
    ON CONFLICT (user_id, installation_id) WHERE installation_id IS NOT NULL DO UPDATE SET platform=EXCLUDED.platform,device_name=EXCLUDED.device_name,app_version=EXCLUDED.app_version,os_version=EXCLUDED.os_version,last_seen_at=now(),disabled_at=NULL,updated_at=now()
    RETURNING id`;
  return rows[0] ?? null;
}

export async function listDevices(userId: string) {
  return authDb()<
    Array<{
      id: string;
      platform: string;
      deviceName: string | null;
      appVersion: string | null;
      osVersion: string | null;
      lastSeenAt: Date;
      disabledAt: Date | null;
    }>
  >`
    SELECT id, platform, device_name AS "deviceName", app_version AS "appVersion", os_version AS "osVersion", last_seen_at AS "lastSeenAt", disabled_at AS "disabledAt"
    FROM user_devices WHERE user_id = ${userId} AND disabled_at IS NULL ORDER BY created_at DESC`;
}

export async function removeDevice(userId: string, deviceId: string) {
  await authDb()`UPDATE user_devices SET disabled_at = now(), updated_at = now() WHERE id = ${deviceId} AND user_id = ${userId}`;
}

export async function upsertPushToken(
  userId: string,
  deviceId: string,
  provider: string,
  token: string,
) {
  return authDb().begin(async tx=>{
    const hash=tokenHash(token),ciphertext=encryptSecret(token);
    await tx`UPDATE user_push_tokens SET invalidated_at=now(),updated_at=now() WHERE user_id=${userId} AND device_id=${deviceId} AND provider=${provider} AND token_hash<>${hash} AND invalidated_at IS NULL`;
    const rows=await tx<Array<{id:string}>>`
      INSERT INTO user_push_tokens (id,user_id,device_id,provider,token_hash,token_ciphertext,created_at,updated_at,last_validated_at)
      SELECT ${randomUUID()},${userId},id,${provider},${hash},${ciphertext},now(),now(),now()
      FROM user_devices WHERE id=${deviceId} AND user_id=${userId} AND disabled_at IS NULL
      ON CONFLICT (user_id,device_id,provider,token_hash) DO UPDATE SET token_ciphertext=EXCLUDED.token_ciphertext,updated_at=now(),last_validated_at=now(),invalidated_at=NULL
      RETURNING id`;
    return rows[0]??null;
  });
}

export async function invalidatePushToken(userId: string, tokenId: string) {
  await authDb()`UPDATE user_push_tokens SET invalidated_at = now(), updated_at = now() WHERE id = ${tokenId} AND user_id = ${userId}`;
}

export async function listPushTokens(userId: string) {
  return authDb()<
    Array<{ id: string; deviceId: string; provider: string; lastValidatedAt: Date | null }>
  >`
    SELECT id, device_id AS "deviceId", provider, last_validated_at AS "lastValidatedAt"
    FROM user_push_tokens WHERE user_id = ${userId} AND invalidated_at IS NULL ORDER BY created_at DESC`;
}

export async function listDeliverablePushTokens(userId: string) {
  const rows = await authDb()<Array<{id:string;deviceId:string;provider:string;tokenCiphertext:string}>>`
    SELECT t.id,t.device_id AS "deviceId",t.provider,t.token_ciphertext AS "tokenCiphertext"
    FROM user_push_tokens t JOIN user_devices d ON d.id=t.device_id
    WHERE t.user_id=${userId} AND t.invalidated_at IS NULL AND t.token_ciphertext IS NOT NULL AND d.disabled_at IS NULL`;
  return rows.map(row=>({...row,token:decryptSecret(row.tokenCiphertext)}));
}

export async function getNotificationPreferences(userId: string) {
  return authDb()<
    Array<{
      id: string;
      category: string;
      channel: string;
      enabled: boolean;
      minimumPriority: string;
      topicType: string | null;
      topicId: string | null;
    }>
  >`
    SELECT id, topic_type AS "topicType", topic_id AS "topicId", category, channel, enabled, minimum_priority AS "minimumPriority"
    FROM user_notification_preferences WHERE user_id = ${userId} ORDER BY created_at DESC`;
}

export async function updateNotificationPreferences(
  userId: string,
  input: {
    topicType?: string | null;
    topicId?: string | null;
    category: string;
    channel: string;
    enabled: boolean;
    minimumPriority?: string;
  },
) {
  const rows = await authDb()<Array<{ id: string }>>`
    INSERT INTO user_notification_preferences (id, user_id, topic_type, topic_id, category, channel, enabled, minimum_priority, updated_at)
    VALUES (${randomUUID()}, ${userId}, ${input.topicType ?? null}, ${input.topicId ?? null}, ${input.category}, ${input.channel}, ${input.enabled}, ${input.minimumPriority ?? 'NORMAL'}, now())
    ON CONFLICT (user_id, topic_type, topic_id, category, channel) DO UPDATE SET enabled = EXCLUDED.enabled, minimum_priority = EXCLUDED.minimum_priority, updated_at = now()
    RETURNING id`;
  return rows[0] ?? null;
}

export async function addPhoneNumber(userId: string, phoneNumber: string) {
  const normalized = phoneNumber.replace(/\s+/g, '');
  const rows = await authDb()<Array<{ id: string }>>`
    INSERT INTO user_phone_numbers (id, user_id, phone_number, is_verified, verified_at, created_at)
    VALUES (${randomUUID()}, ${userId}, ${normalized}, false, null, now())
    ON CONFLICT (user_id, phone_number) DO NOTHING
    RETURNING id`;
  return rows[0] ?? null;
}

export async function verifyPhoneNumber(userId: string, phoneNumber: string) {
  await authDb()`UPDATE user_phone_numbers SET is_verified = true, verified_at = now(), updated_at = now() WHERE user_id = ${userId} AND phone_number = ${phoneNumber}`;
}

export async function removePhoneNumber(userId: string, phoneNumber: string) {
  await authDb()`UPDATE user_phone_numbers SET removed_at = now(), updated_at = now() WHERE user_id = ${userId} AND phone_number = ${phoneNumber}`;
}

export async function grantConsent(
  userId: string,
  input: {
    channel: string;
    consentType: string;
    policyVersion: string;
    source: string;
    metadata?: Record<string, unknown> | null;
  },
) {
  const sql = authDb();
  const metadata = input.metadata ? sql.json(JSON.parse(JSON.stringify(input.metadata))) : null;
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO user_consents (id, user_id, channel, consent_type, policy_version, granted_at, source, metadata)
    VALUES (${randomUUID()}, ${userId}, ${input.channel}, ${input.consentType}, ${input.policyVersion}, now(), ${input.source}, ${metadata})
    RETURNING id`;
  return rows[0] ?? null;
}

export async function revokeConsent(userId: string, consentType: string, channel: string) {
  await authDb()`UPDATE user_consents SET revoked_at = now(), updated_at = now() WHERE user_id = ${userId} AND consent_type = ${consentType} AND channel = ${channel} AND revoked_at IS NULL ORDER BY granted_at DESC LIMIT 1`;
}

export async function listInbox(userId: string) {
  return authDb()<
    Array<{
      id: string;
      title: string;
      body: string;
      deepLink: string | null;
      imageUrl: string | null;
      createdAt: Date;
      readAt: Date | null;
      dismissedAt: Date | null;
    }>
  >`
    SELECT id, title, body, deep_link AS "deepLink", image_url AS "imageUrl", created_at AS "createdAt", read_at AS "readAt", dismissed_at AS "dismissedAt"
    FROM user_notifications WHERE user_id = ${userId} AND dismissed_at IS NULL ORDER BY created_at DESC`;
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await authDb()`UPDATE user_notifications SET read_at = now(), updated_at = now() WHERE id = ${notificationId} AND user_id = ${userId}`;
}

export async function markAllNotificationsRead(userId: string) {
  await authDb()`UPDATE user_notifications SET read_at = now(), updated_at = now() WHERE user_id = ${userId} AND read_at IS NULL`;
}

export async function dismissNotification(userId: string, notificationId: string) {
  await authDb()`UPDATE user_notifications SET dismissed_at = now(), updated_at = now() WHERE id = ${notificationId} AND user_id = ${userId}`;
}

export async function createNotification(
  userId: string,
  input: {
    eventId: string;
    title: string;
    body: string;
    deepLink?: string | null;
    imageUrl?: string | null;
  },
) {
  const rows = await authDb()<Array<{ id: string }>>`
    INSERT INTO user_notifications (id, user_id, event_id, title, body, deep_link, image_url, created_at)
    VALUES (${randomUUID()}, ${userId}, ${input.eventId}, ${input.title}, ${input.body}, ${input.deepLink ?? null}, ${input.imageUrl ?? null}, now())
    RETURNING id`;
  return rows[0] ?? null;
}

export async function recordDelivery(
  notificationId: string,
  channel: string,
  provider: string,
  state: string,
  deviceId?: string | null,
  failureCode?: string | null,
) {
  await authDb()`INSERT INTO notification_deliveries (id, notification_id, channel, device_id, provider, state, attempted_at, delivered_at, failed_at, failure_code) VALUES (${randomUUID()}, ${notificationId}, ${channel}, ${deviceId ?? null}, ${provider}, ${state}, now(), ${state === 'DELIVERED' ? new Date() : null}, ${state === 'FAILED' ? new Date() : null}, ${failureCode ?? null})`;
}
