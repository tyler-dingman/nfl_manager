import { importEditorial } from './import-editorial';
import { Storage } from './core';
import type { PostgresExport } from './import';
import { importExecutableFranchises } from './import-franchise';
/** Explicit table allowlist for schemas with reviewed, matching relational fields.
 * No SQL translation and no source connection. Call only on an isolated target.
 * The original row text must already be retained by importPostgres. */
const tables = [
  'user_devices',
  'user_push_tokens',
  'user_notification_preferences',
  'user_phone_numbers',
  'user_consents',
  'security_audit_events',
  'email_change_requests',
  'user_content_state',
  'user_team_visit_state',
  'user_poll_votes',
  'huddle_messages',
  'huddle_reactions',
  'huddle_user_filters',
  'huddle_reports',
  'huddle_enforcement',
  'huddle_polls',
  'huddle_poll_votes',
  'crews',
  'crew_members',
  'crew_invites',
  'crew_activity',
  'crew_reactions',
  'crew_shares',
  'crew_share_recipients',
  'crew_comments',
  'game_day_rooms',
  'game_day_room_members',
  'game_day_activity',
  'game_day_reactions',
  'game_day_predictions',
  'game_day_events',
  'fan_pulse_reactions',
  'trivia_games',
  'trivia_game_questions',
  'trivia_game_participants',
  'trivia_friendships',
  'trivia_challenges',
  'trivia_groups',
  'trivia_invitations',
  'trivia_rank_snapshots',
  'trivia_events',
  'trivia_event_registrations',
  'commerce_products',
  'commerce_product_variants',
  'commerce_promo_codes',
  'commerce_orders',
  'commerce_order_items',
  'commerce_inventory_adjustments',
  'commerce_stripe_webhook_events',
  'commerce_refunds',
] as const;
const aliases: Record<string, string> = {
  user_devices: 'app_devices',
  user_push_tokens: 'app_push_tokens',
  user_notification_preferences: 'app_notification_preferences',
  user_phone_numbers: 'app_phone_numbers',
  user_consents: 'app_consents',
  security_audit_events: 'app_security_audit',
};
const target = (name: string) =>
  aliases[name] ?? (name === 'trivia_daily_questions' ? 'app_trivia_daily' : 'app_' + name);
const dates = new Set([
  'consumed_at',
  'created_at',
  'disabled_at',
  'last_validated_at',
  'invalidated_at',
  'granted_at',
  'revoked_at',
  'first_viewed_at',
  'last_viewed_at',
  'first_seen_at',
  'current_visit_started_at',
  'last_visited_at',
  'last_caught_up_at',
  'updated_at',
  'published_at',
  'discovered_at',
  'removed_at',
  'expires_at',
  'accepted_at',
  'joined_at',
  'last_seen_at',
  'archived_at',
  'kickoff_at',
  'locked_at',
  'settled_at',
  'started_at',
  'completed_at',
  'presented_at',
  'answered_at',
  'registered_at',
  'shipped_at',
  'delivered_at',
  'canceled_at',
  'paid_at',
  'payment_attempt_started_at',
  'stripe_created_at',
  'processed_at',
  'received_at',
  'responded_at',
]);
export async function importRelationalDomains(s: Storage, source: PostgresExport) {
  if (source.schema !== 1 || source.mode !== 'SYNTHETIC_REPEATABLE_READ')
    throw Error('Synthetic snapshot required');
  const sourceRows = (name: string) =>
    source.tables.find((t) => t.name === name)?.rows.map((r) => JSON.parse(r)) ?? [];
  let typed = 0;
  const imported: string[] = [];
  for (const name of tables) {
    const rows = sourceRows(name);
    if (!rows.length) continue;
    const to = target(name),
      columns = await s.rows<{
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
      }>('PRAGMA table_info(' + to + ')');
    if (!columns.length) throw Error('Missing D1 target ' + to);
    for (const row of rows) {
      if (name === 'user_devices') row.name = row.device_name;
      if (name === 'user_push_tokens' && row.provider === 'WEB_PUSH')
        row.web_endpoint_hash = row.token_hash;
      if (name === 'user_consents' || name === 'security_audit_events')
        row.metadata_hash = await s.put(row.metadata ?? {});

      if (name === 'trivia_groups' && row.expires_at == null)
        row.expires_at = new Date(new Date(row.created_at).getTime() + 86400000).toISOString();
      const fields = columns.filter((c) => Object.hasOwn(row, c.name)),
        values = fields.map((c) => {
          const v = row[c.name];
          if (v == null) return null;
          if (dates.has(c.name)) return new Date(v).getTime();
          if (typeof v === 'boolean') return v ? 1 : 0;
          if (typeof v === 'object') return JSON.stringify(v);
          return v;
        });
      // Fresh targets contain only the three seeded promo definitions. Preserve exported counters.
      const conflict =
        name === 'commerce_promo_codes'
          ? ' ON CONFLICT(code) DO UPDATE SET ' +
            fields
              .filter((c) => c.name !== 'code')
              .map((c) => c.name + '=excluded.' + c.name)
              .join(',')
          : '';
      await s
        .statement(
          'INSERT INTO ' +
            to +
            '(' +
            fields.map((c) => c.name).join(',') +
            ') VALUES(' +
            fields.map(() => '?').join(',') +
            ')' +
            conflict,
          values,
        )
        .run();
      typed++;
    }
    imported.push(name);
  }
  for (const row of sourceRows('user_predictions')) {
    const hash = await s.put({
      schema: 1,
      id: row.id,
      owner: row.user_id,
      prediction: row.prediction,
      metadata: row.metadata ?? {},
    });
    await s
      .statement(
        'INSERT INTO app_user_predictions(id,user_id,prediction_type,subject_type,subject_id,object_hash,submitted_at,locked_at,resolved_at,result,score) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        [
          row.id,
          row.user_id,
          row.prediction_type,
          row.subject_type,
          row.subject_id,
          hash,
          new Date(row.submitted_at).getTime(),
          row.locked_at ? new Date(row.locked_at).getTime() : null,
          row.resolved_at ? new Date(row.resolved_at).getTime() : null,
          row.result,
          row.score == null ? null : Number(row.score),
        ],
      )
      .run();
    typed++;
  }
  if (sourceRows('user_predictions').length) imported.push('user_predictions');
  for (const row of sourceRows('user_notifications')) {
    const value = Object.fromEntries(
      Object.entries(row)
        .filter(([k]) => !['id', 'user_id'].includes(k))
        .map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v]),
    );
    const hash = await s.put({ schema: 1, id: row.id, owner: row.user_id, value });
    await s
      .statement(
        'INSERT INTO app_notifications(id,user_id,dedupe_key,team_abbr,object_hash,created_at,read_at,seen_at,dismissed_at,expires_at,delivery_state,push_sent_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        [
          row.id,
          row.user_id,
          row.dedupe_key ?? row.event_id ?? null,
          row.team_abbr ?? null,
          hash,
          new Date(row.created_at).getTime(),
          row.read_at ? new Date(row.read_at).getTime() : null,
          row.seen_at ? new Date(row.seen_at).getTime() : null,
          row.dismissed_at ? new Date(row.dismissed_at).getTime() : null,
          row.expires_at ? new Date(row.expires_at).getTime() : null,
          row.delivery_state ?? 'PUSH_NOT_ELIGIBLE',
          row.push_sent_at ? new Date(row.push_sent_at).getTime() : null,
        ],
      )
      .run();
    typed++;
  }
  if (sourceRows('user_notifications').length) imported.push('user_notifications');
  for (const row of sourceRows('notification_deliveries')) {
    await s
      .statement(
        'INSERT INTO app_notification_deliveries(id,notification_id,channel,device_id,provider,state,attempted_at,delivered_at,failed_at,failure_code) VALUES(?,?,?,?,?,?,?,?,?,?)',
        [
          row.id,
          row.notification_id,
          row.channel,
          row.device_id,
          row.provider,
          row.state,
          new Date(row.attempted_at).getTime(),
          row.delivered_at ? new Date(row.delivered_at).getTime() : null,
          row.failed_at ? new Date(row.failed_at).getTime() : null,
          row.failure_code,
        ],
      )
      .run();
    typed++;
  }
  if (sourceRows('notification_deliveries').length) imported.push('notification_deliveries');
  for (const row of sourceRows('trivia_answers')) {
    if (!row.game_id) continue;
    const to = row.game_id ? 'app_trivia_game_answers' : 'app_trivia_answers';
    await s
      .statement(
        'INSERT INTO ' +
          to +
          '(id,user_id,question_id,' +
          (row.game_id ? 'game_id' : 'daily_id') +
          ',selected_answer,correct,response_time_ms,points_awarded,answered_at) VALUES(?,?,?,?,?,?,?,?,?)',
        [
          row.id,
          row.user_id,
          row.question_id,
          row.game_id ?? row.daily_question_id,
          row.selected_answer,
          row.correct ? 1 : 0,
          row.response_time_ms,
          row.points_awarded,
          new Date(row.answered_at).getTime(),
        ],
      )
      .run();
    typed++;
  }
  if (sourceRows('trivia_answers').length) imported.push('trivia_answers');
  for (const row of sourceRows('crew_media')) {
    const bytes =
        typeof row.content === 'string' && row.content.startsWith('\\x')
          ? Buffer.from(row.content.slice(2), 'hex')
          : Buffer.from(row.content?.data ?? row.content ?? []),
      hash = await s.put({
        schema: 1,
        owner: row.uploader_user_id,
        crewId: row.crew_id,
        id: row.id,
        mime: row.mime_type,
        body: bytes.toString('base64'),
      });
    await s
      .statement(
        'INSERT INTO app_crew_media(id,crew_id,uploader_user_id,mime_type,object_hash,bytes,created_at) VALUES(?,?,?,?,?,?,?)',
        [
          row.id,
          row.crew_id,
          row.uploader_user_id,
          row.mime_type,
          hash,
          bytes.length,
          new Date(row.created_at).getTime(),
        ],
      )
      .run();
    typed++;
  }
  if (sourceRows('crew_media').length) imported.push('crew_media');
  for (const row of sourceRows('users'))
    if (row.is_guest)
      await s.statement('UPDATE app_users SET is_guest=1 WHERE id=?', [row.id]).run();
  const [number] = await s.rows<any>(
    "SELECT max(CAST(substr(order_number,5) AS INTEGER)) AS n FROM app_commerce_orders WHERE order_number GLOB 'DND-[0-9]*'",
  );
  await s
    .statement(
      "INSERT INTO app_commerce_counters(name,next_value) VALUES('order_number',?) ON CONFLICT(name) DO UPDATE SET next_value=max(next_value,excluded.next_value)",
      [number.n ?? 1042],
    )
    .run();
  const editorial = await importEditorial(s, source);
  const franchise = await importExecutableFranchises(s, source);
  if ((await s.rows('PRAGMA foreign_key_check')).length)
    throw Error('Domain import integrity check failed');
  return { typedRows: typed, tables: imported, franchise, editorial };
}
