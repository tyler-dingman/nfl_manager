import { Storage } from './core';
import { encryptSecret, decryptSecret, tokenHash } from '../../src/server/auth/crypto';
import type * as PG from '../../src/server/notifications/repository-postgres';
const date = (n: number | null) => (n == null ? null : new Date(n));
export class D1Notifications {
  constructor(readonly s: Storage) {}
  async registerDevice(user: string, input: Parameters<typeof PG.registerDevice>[1]) {
    const rows = await this.s.rows<any>(
      'INSERT INTO app_devices(id,user_id,platform,name,app_version,os_version,installation_id,last_seen_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,installation_id) WHERE installation_id IS NOT NULL DO UPDATE SET platform=excluded.platform,name=excluded.name,app_version=excluded.app_version,os_version=excluded.os_version,last_seen_at=excluded.last_seen_at,disabled_at=NULL RETURNING id',
      [
        crypto.randomUUID(),
        user,
        input.platform,
        input.deviceName ?? null,
        input.appVersion ?? null,
        input.osVersion ?? null,
        input.installationId,
        Date.now(),
      ],
    );
    return rows[0] ?? null;
  }
  async listDevices(user: string) {
    return (
      await this.s.rows<any>(
        'SELECT id,platform,name AS deviceName,app_version AS appVersion,os_version AS osVersion,last_seen_at AS lastSeenAt FROM app_devices WHERE user_id=? AND disabled_at IS NULL ORDER BY last_seen_at DESC',
        [user],
      )
    ).map((r) => ({ ...r, lastSeenAt: date(r.lastSeenAt) }));
  }
  async removeDevice(user: string, id: string) {
    await this.s
      .statement('UPDATE app_devices SET disabled_at=? WHERE id=? AND user_id=?', [
        Date.now(),
        id,
        user,
      ])
      .run();
  }
  async upsertPushToken(user: string, device: string, provider: string, token: string) {
    const hash = tokenHash(token),
      ciphertext = encryptSecret(token),
      now = Date.now();
    const id = crypto.randomUUID();
    const result = await this.s.batch([
      this.s.statement(
        'UPDATE app_push_tokens SET invalidated_at=? WHERE user_id=? AND device_id=? AND provider=? AND token_hash<>? AND invalidated_at IS NULL',
        [now, user, device, provider, hash],
      ),
      this.s.statement(
        'INSERT INTO app_push_tokens(id,user_id,device_id,provider,token_hash,token_ciphertext,created_at,last_validated_at) SELECT ?,?,id,?,?,?,?,? FROM app_devices WHERE id=? AND user_id=? AND disabled_at IS NULL ON CONFLICT(user_id,device_id,provider,token_hash) DO UPDATE SET token_ciphertext=excluded.token_ciphertext,last_validated_at=excluded.last_validated_at,invalidated_at=NULL RETURNING id',
        [id, user, provider, hash, ciphertext, now, now, device, user],
      ),
    ]);
    return result[1].results[0] ?? null;
  }
  async invalidatePushToken(user: string, id: string) {
    await this.s
      .statement('UPDATE app_push_tokens SET invalidated_at=? WHERE id=? AND user_id=?', [
        Date.now(),
        id,
        user,
      ])
      .run();
  }
  async listPushTokens(user: string) {
    return (
      await this.s.rows<any>(
        'SELECT id,device_id AS deviceId,provider,last_validated_at AS lastValidatedAt FROM app_push_tokens WHERE user_id=? AND invalidated_at IS NULL ORDER BY created_at DESC',
        [user],
      )
    ).map((r) => ({ ...r, lastValidatedAt: date(r.lastValidatedAt) }));
  }
  async listDeliverablePushTokens(user: string) {
    return (
      await this.s.rows<any>(
        'SELECT t.id,t.device_id AS deviceId,t.provider,t.token_ciphertext AS tokenCiphertext FROM app_push_tokens t JOIN app_devices d ON d.id=t.device_id WHERE t.user_id=? AND t.invalidated_at IS NULL AND d.disabled_at IS NULL',
        [user],
      )
    ).map((r) => ({ ...r, token: decryptSecret(r.tokenCiphertext) }));
  }
  async getNotificationPreferences(user: string) {
    return (
      await this.s.rows<any>(
        'SELECT id,topic_type AS topicType,topic_id AS topicId,category,channel,enabled,minimum_priority AS minimumPriority,delivery_time AS deliveryTime,delivery_timezone AS deliveryTimezone FROM app_notification_preferences WHERE user_id=? ORDER BY created_at DESC',
        [user],
      )
    ).map((r) => ({ ...r, enabled: Boolean(r.enabled) }));
  }
  async getDeliveryReadiness(user: string) {
    const [row] = await this.s.rows<any>(
      'SELECT EXISTS(SELECT 1 FROM app_phone_numbers WHERE user_id=? AND is_verified=1 AND removed_at IS NULL) AS hasVerifiedPhone,EXISTS(SELECT 1 FROM app_push_tokens t JOIN app_devices d ON d.id=t.device_id WHERE t.user_id=? AND t.invalidated_at IS NULL AND d.disabled_at IS NULL) AS hasPushDevice',
      [user, user],
    );
    return {
      hasVerifiedPhone: Boolean(row.hasVerifiedPhone),
      hasPushDevice: Boolean(row.hasPushDevice),
    };
  }
  async updateNotificationPreferences(
    user: string,
    input: Parameters<typeof PG.updateNotificationPreferences>[1],
  ) {
    const rows = await this.s.rows<any>(
      'INSERT INTO app_notification_preferences(id,user_id,topic_type,topic_id,category,channel,enabled,minimum_priority,created_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,topic_type,topic_id,category,channel) DO UPDATE SET enabled=excluded.enabled,minimum_priority=excluded.minimum_priority RETURNING id',
      [
        crypto.randomUUID(),
        user,
        input.topicType ?? null,
        input.topicId ?? null,
        input.category,
        input.channel,
        input.enabled ? 1 : 0,
        input.minimumPriority ?? 'NORMAL',
        Date.now(),
      ],
    );
    return rows[0] ?? null;
  }
  async addPhoneNumber(user: string, phone: string) {
    const rows = await this.s.rows<any>(
      'INSERT INTO app_phone_numbers(id,user_id,phone_number) VALUES(?,?,?) ON CONFLICT DO NOTHING RETURNING id',
      [crypto.randomUUID(), user, phone.replace(/\s+/g, '')],
    );
    return rows[0] ?? null;
  }
  async verifyPhoneNumber(user: string, phone: string) {
    await this.s
      .statement(
        'UPDATE app_phone_numbers SET is_verified=1,verified_at=? WHERE user_id=? AND phone_number=?',
        [Date.now(), user, phone],
      )
      .run();
  }
  async removePhoneNumber(user: string, phone: string) {
    await this.s
      .statement('UPDATE app_phone_numbers SET removed_at=? WHERE user_id=? AND phone_number=?', [
        Date.now(),
        user,
        phone,
      ])
      .run();
  }
  async grantConsent(user: string, input: Parameters<typeof PG.grantConsent>[1]) {
    const hash = input.metadata ? await this.s.put(input.metadata) : null;
    const id = crypto.randomUUID();
    await this.s
      .statement(
        'INSERT INTO app_consents(id,user_id,channel,consent_type,policy_version,granted_at,source,metadata_hash) VALUES(?,?,?,?,?,?,?,?)',
        [
          id,
          user,
          input.channel,
          input.consentType,
          input.policyVersion,
          Date.now(),
          input.source,
          hash,
        ],
      )
      .run();
    return { id };
  }
  async revokeConsent(user: string, type: string, channel: string) {
    await this.s
      .statement(
        'UPDATE app_consents SET revoked_at=? WHERE id=(SELECT id FROM app_consents WHERE user_id=? AND consent_type=? AND channel=? AND revoked_at IS NULL ORDER BY granted_at DESC LIMIT 1)',
        [Date.now(), user, type, channel],
      )
      .run();
  }
  async listInbox(user: string, options: Parameters<typeof PG.listInbox>[1] = {}) {
    const rows = await this.s.rows<any>(
      'SELECT * FROM app_notifications WHERE user_id=? AND dismissed_at IS NULL AND (expires_at IS NULL OR expires_at>?) AND (? IS NULL OR team_abbr IS NULL OR team_abbr=?) AND (? IS NULL OR created_at<?) AND (?=0 OR read_at IS NULL) ORDER BY created_at DESC,id LIMIT ?',
      [
        user,
        Date.now(),
        options.teamAbbr ?? null,
        options.teamAbbr ?? null,
        options.cursor?.getTime() ?? null,
        options.cursor?.getTime() ?? null,
        options.unreadOnly ? 1 : 0,
        Math.min(50, Math.max(1, options.limit ?? 20)),
      ],
    );
    return Promise.all(
      rows.map(async (r) => {
        const payload = await this.s.get<any>(r.object_hash);
        if (payload.owner !== user || payload.id !== r.id)
          throw Error('Notification ownership mismatch');
        return {
          ...payload.value,
          id: r.id,
          createdAt: date(r.created_at),
          readAt: date(r.read_at),
          seenAt: date(r.seen_at),
          dismissedAt: date(r.dismissed_at),
          expiresAt: date(r.expires_at),
          deliveryState: r.delivery_state,
        };
      }),
    );
  }
  async exportNotifications(user: string) {
    const rows = await this.s.rows<any>(
      'SELECT id,object_hash,created_at,read_at FROM app_notifications WHERE user_id=? ORDER BY created_at DESC,id',
      [user],
    );
    const result = [];
    for (const r of rows) {
      const p = await this.s.get<any>(r.object_hash);
      if (p.owner !== user || p.id !== r.id) throw Error('Notification ownership mismatch');
      result.push({
        id: r.id,
        title: p.value.title,
        body: p.value.body,
        deepLink: p.value.deepLink,
        createdAt: date(r.created_at),
        readAt: date(r.read_at),
      });
    }
    return result;
  }
  async unreadNotificationCount(user: string, team?: string | null) {
    const [r] = await this.s.rows<any>(
      'SELECT count(*) AS count FROM app_notifications WHERE user_id=? AND read_at IS NULL AND dismissed_at IS NULL AND (expires_at IS NULL OR expires_at>?) AND (? IS NULL OR team_abbr IS NULL OR team_abbr=?)',
      [user, Date.now(), team ?? null, team ?? null],
    );
    return r.count;
  }
  async markNotificationsSeen(user: string) {
    await this.s
      .statement(
        'UPDATE app_notifications SET seen_at=? WHERE user_id=? AND dismissed_at IS NULL AND seen_at IS NULL',
        [Date.now(), user],
      )
      .run();
  }
  async markNotificationRead(user: string, id: string) {
    await this.s
      .statement('UPDATE app_notifications SET read_at=? WHERE id=? AND user_id=?', [
        Date.now(),
        id,
        user,
      ])
      .run();
  }
  async markAllNotificationsRead(user: string) {
    await this.s
      .statement('UPDATE app_notifications SET read_at=? WHERE user_id=? AND read_at IS NULL', [
        Date.now(),
        user,
      ])
      .run();
  }
  async dismissNotification(user: string, id: string) {
    await this.s
      .statement('UPDATE app_notifications SET dismissed_at=? WHERE id=? AND user_id=?', [
        Date.now(),
        id,
        user,
      ])
      .run();
  }
  async createNotification(user: string, input: Parameters<typeof PG.createNotification>[1]) {
    const id = crypto.randomUUID(),
      state = input.deliveryState ?? (input.pushEligible ? 'PUSH_PENDING' : 'PUSH_NOT_ELIGIBLE');
    const value = {
      ...input,
      deepLink: input.deepLink ?? null,
      imageUrl: input.imageUrl ?? null,
      teamAbbr: input.teamAbbr ?? null,
      type: input.type ?? 'SYSTEM',
      category: input.category ?? input.type ?? 'SYSTEM',
      contentId: input.contentId ?? null,
      contentType: input.contentType ?? null,
      priority: input.priority ?? 'NORMAL',
      pushEligible: input.pushEligible ?? false,
      metadata: input.metadata ?? {},
    };
    const hash = await this.s.put({ schema: 1, id, owner: user, value });
    return (
      (
        await this.s.rows<any>(
          'INSERT INTO app_notifications(id,user_id,dedupe_key,team_abbr,object_hash,created_at,expires_at,delivery_state) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,dedupe_key) DO NOTHING RETURNING id',
          [
            id,
            user,
            input.dedupeKey ?? input.eventId,
            input.teamAbbr ?? null,
            hash,
            Date.now(),
            input.expiresAt?.getTime() ?? null,
            state,
          ],
        )
      )[0] ?? null
    );
  }
  async recordDelivery(
    id: string,
    channel: string,
    provider: string,
    state: string,
    device?: string | null,
    failure?: string | null,
  ) {
    const now = Date.now();
    await this.s
      .statement(
        'INSERT INTO app_notification_deliveries(id,notification_id,channel,device_id,provider,state,attempted_at,delivered_at,failed_at,failure_code) VALUES(?,?,?,?,?,?,?,?,?,?)',
        [
          crypto.randomUUID(),
          id,
          channel,
          device ?? null,
          provider,
          state,
          now,
          state === 'DELIVERED' ? now : null,
          state === 'FAILED' ? now : null,
          failure ?? null,
        ],
      )
      .run();
  }
  async finishPushDelivery(id: string, delivered: number) {
    await this.s
      .statement('UPDATE app_notifications SET delivery_state=?,push_sent_at=? WHERE id=?', [
        delivered > 0 ? 'PUSH_SENT' : 'PUSH_FAILED',
        delivered > 0 ? Date.now() : null,
        id,
      ])
      .run();
  }
}
