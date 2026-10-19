import { Storage } from './core';
import { D1Notifications, notificationValue } from './notifications';
export async function socialNotification(
  s: Storage,
  user: string,
  id: string,
  input: Parameters<D1Notifications['createNotification']>[1],
) {
  const hash = await s.put({
    schema: 1,
    kind: 'PREPARED_NOTIFICATION',
    owner: user,
    id: crypto.randomUUID(),
    outboxId: id,
    value: notificationValue(input),
  });
  return s.statement(
    "INSERT INTO app_social_notification_outbox(id,user_id,object_hash,status,created_at) VALUES(?,?,?,'READY',?) ON CONFLICT DO NOTHING",
    [id, user, hash, Date.now()],
  );
}
export async function socialNotificationBatch(
  s: Storage,
  owner: string,
  id: string,
  notifications: { user: string; input: Parameters<D1Notifications['createNotification']>[1] }[],
) {
  const hash = await s.put({ schema: 2, owner, id, notifications });
  return s.statement(
    "INSERT INTO app_social_notification_outbox(id,user_id,object_hash,status,created_at) VALUES(?,?,?,'READY',?) ON CONFLICT DO NOTHING",
    [id, owner, hash, Date.now()],
  );
}
/** Idempotent inbox delivery after the originating social transaction commits.
 * No provider requests. A crash after inbox insertion safely replays its dedupe key. */
export async function drainSocialNotifications(s: Storage, limit = 3, now = Date.now()) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 3)
    throw Error('Social delivery batch limit');
  let delivered = 0;
  const rows = await s.rows<any>(
    "SELECT * FROM app_social_notification_outbox WHERE (status='READY' OR (status='RUNNING' AND lease_until<?)) AND attempts<10 ORDER BY created_at,id LIMIT ?",
    [now, limit],
  );
  for (const row of rows) {
    if (delivered >= limit) break;
    const prepared = await s.get<any>(row.object_hash);
    if (prepared.kind === 'PREPARED_NOTIFICATION') {
      if (
        prepared.schema !== 1 ||
        prepared.owner !== row.user_id ||
        prepared.outboxId !== row.id ||
        !prepared.id ||
        !prepared.value
      )
        throw Error('Prepared notification ownership mismatch');
      const v = prepared.value,
        nonce = crypto.randomUUID();
      const expires = v.expiresAt == null ? null : Date.parse(v.expiresAt);
      if (expires !== null && !Number.isFinite(expires)) throw Error('Invalid notification expiry');
      // Immutable outbox payload is already a complete inbox envelope. Publish
      // inbox + cursor atomically, without a second upload or claim transaction.
      try {
        await s.batch([
          s.statement(
            "INSERT INTO app_storage_guards(id,ok) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM app_social_notification_outbox WHERE id=? AND object_hash=? AND cursor=? AND attempts<10 AND (status='READY' OR(status='RUNNING' AND lease_until<?))) THEN 1 ELSE 0 END)",
            [nonce, row.id, row.object_hash, row.cursor, now],
          ),
          s.statement(
            'INSERT INTO app_notifications(id,user_id,dedupe_key,team_abbr,object_hash,created_at,expires_at,delivery_state) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,dedupe_key) DO NOTHING',
            [
              prepared.id,
              row.user_id,
              v.dedupeKey ?? v.eventId,
              v.teamAbbr,
              row.object_hash,
              now,
              expires,
              v.deliveryState ?? (v.pushEligible ? 'PUSH_PENDING' : 'PUSH_NOT_ELIGIBLE'),
            ],
          ),
          s.statement(
            "UPDATE app_social_notification_outbox SET status='DONE',cursor=1,lease_until=0,error=NULL WHERE id=?",
            [row.id],
          ),
          s.statement(
            "UPDATE app_crew_invites SET delivery_state='DELIVERED' WHERE 'crew-invite:'||id=?",
            [row.id],
          ),
          s.statement('DELETE FROM app_storage_guards WHERE id=?', [nonce]),
        ]);
        delivered++;
      } catch (error) {
        const [current] = await s.rows<any>(
          'SELECT status,cursor FROM app_social_notification_outbox WHERE id=?',
          [row.id],
        );
        if (!current || current.status !== 'DONE') throw error;
      }
      continue;
    }
    const nonce = crypto.randomUUID();
    const claim = await s
      .statement(
        "UPDATE app_social_notification_outbox SET status='RUNNING',lease_nonce=?,lease_until=?,attempts=attempts+1 WHERE id=? AND (status='READY' OR (status='RUNNING' AND lease_until<?)) RETURNING id",
        [nonce, now + 60000, row.id, now],
      )
      .first();
    if (!claim) continue;
    try {
      const p = prepared;
      if (![1, 2].includes(p.schema) || p.owner !== row.user_id || p.id !== row.id)
        throw Error('Social notification ownership mismatch');
      const items = p.schema === 1 ? [{ user: row.user_id, input: p.input }] : p.notifications;
      if (!Array.isArray(items) || items.length > 250) throw Error('Social fanout limit');
      let cursor = row.cursor;
      while (cursor < items.length && delivered < limit) {
        const item = items[cursor];
        await new D1Notifications(s).createNotification(item.user, item.input);
        cursor++;
        delivered++;
      }
      const done = cursor === items.length;
      await s.batch([
        s.statement(
          'UPDATE app_social_notification_outbox SET status=?,cursor=?,lease_until=0,error=NULL,attempts=CASE WHEN ? THEN attempts ELSE 0 END WHERE id=? AND lease_nonce=?',
          [done ? 'DONE' : 'READY', cursor, done ? 1 : 0, row.id, nonce],
        ),
        s.statement(
          "UPDATE app_crew_invites SET delivery_state='DELIVERED' WHERE 'crew-invite:'||id=? AND ?",
          [row.id, done ? 1 : 0],
        ),
      ]);
    } catch {
      await s
        .statement(
          "UPDATE app_social_notification_outbox SET status=CASE WHEN attempts>=10 THEN 'FAILED' ELSE 'READY' END,lease_until=0,error='DELIVERY_FAILED' WHERE id=? AND lease_nonce=?",
          [row.id, nonce],
        )
        .run();
    }
  }
  return {
    delivered,
    pending: (
      await s.rows<{ n: number }>(
        "SELECT count(*) AS n FROM app_social_notification_outbox WHERE status IN('READY','RUNNING')",
      )
    )[0].n,
  };
}
