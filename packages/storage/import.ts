import{importRelationalDomains}from'./import-domains';
import { Storage, digest, utf8 } from './core';
export interface ExportTable {
  name: string;
  primaryKey: string[];
  rows: string[];
}
export interface PostgresExport {
  schema: 1;
  mode: 'SYNTHETIC_REPEATABLE_READ';
  tables: ExportTable[];
}
const stamp = (value: unknown) => (value == null ? null : new Date(String(value)).getTime());
const json = (value: unknown) => JSON.stringify(value ?? {});
/** Offline staged import. Every source row retains its exact row_to_json text,
 * including unported fields/numeric precision. Typed copies are a reviewed subset,
 * never a declaration that archived gameplay rows have executable D1 adapters. */
export async function importPostgres(s: Storage, source: PostgresExport) {
  if (source.schema !== 1 || source.mode !== 'SYNTHETIC_REPEATABLE_READ')
    throw Error('Only isolated synthetic exports are accepted by this rehearsal');
  let archived = 0,
    typed = 0;
  const definitions: Record<
    string,
    {
      target: string;
      fields: string[];
      values: (r: any) => unknown[];
      eligible?: (r: any) => boolean;
    }
  > = {
    users: {
      target: 'app_users',
      fields: [
        'id',
        'display_name',
        'first_name',
        'last_name',
        'primary_email',
        'email_verified',
        'avatar_url',
        'status',
        'created_at',
        'updated_at',
        'last_login_at',
      ],
      values: (r) => [
        r.id,
        r.display_name,
        r.first_name,
        r.last_name,
        r.primary_email,
        r.email_verified ? 1 : 0,
        r.avatar_url,
        r.status,
        stamp(r.created_at),
        stamp(r.updated_at),
        stamp(r.last_login_at),
      ],
    },
    user_credentials: {
      target: 'app_credentials',
      fields: [
        'user_id',
        'password_hash',
        'failed_attempts',
        'locked_until',
        'password_changed_at',
      ],
      values: (r) => [
        r.user_id,
        r.password_hash,
        r.failed_attempts,
        stamp(r.locked_until),
        stamp(r.password_changed_at),
      ],
    },
    user_identities: {
      target: 'app_identities',
      fields: [
        'id',
        'user_id',
        'provider',
        'provider_subject',
        'provider_email',
        'provider_email_verified',
        'provider_display_name',
        'created_at',
        'last_used_at',
      ],
      values: (r) => [
        r.id,
        r.user_id,
        r.provider,
        r.provider_subject,
        r.provider_email,
        r.provider_email_verified ? 1 : 0,
        r.provider_display_name,
        stamp(r.created_at),
        stamp(r.last_used_at),
      ],
    },
    devices: {
      target: 'app_devices',
      fields: ['id', 'user_id', 'name', 'last_seen_at'],
      values: (r) => [r.id, r.user_id, r.name, stamp(r.last_seen_at)],
    },
    sessions: {
      target: 'app_sessions',
      fields: [
        'id',
        'user_id',
        'device_id',
        'refresh_token_hash',
        'token_family_id',
        'expires_at',
        'revoked_at',
        'replaced_by_session_id',
        'created_at',
        'last_used_at',
        'ip_metadata',
        'user_agent_metadata',
      ],
      values: (r) => [
        r.id,
        r.user_id,
        r.device_id,
        r.refresh_token_hash,
        r.token_family_id,
        stamp(r.expires_at),
        stamp(r.revoked_at),
        r.replaced_by_session_id,
        stamp(r.created_at),
        stamp(r.last_used_at),
        r.ip_metadata,
        r.user_agent_metadata,
      ],
    },
    auth_tokens: {
      target: 'app_tokens',
      fields: ['id', 'user_id', 'type', 'token_hash', 'expires_at', 'consumed_at'],
      values: (r) => [
        r.id,
        r.user_id,
        r.type,
        r.token_hash,
        stamp(r.expires_at),
        stamp(r.consumed_at),
      ],
    },
    user_team_follows: {
      target: 'app_team_follows',
      fields: ['id', 'user_id', 'team_id', 'is_primary', 'notification_level', 'created_at'],
      values: (r) => [
        r.id,
        r.user_id,
        r.team_id,
        r.is_primary ? 1 : 0,
        r.notification_level,
        stamp(r.created_at),
      ],
    },
    user_saved_content: {
      target: 'app_saved_content',
      fields: [
        'id',
        'user_id',
        'content_type',
        'content_id',
        'title',
        'href',
        'image_url',
        'metadata_json',
        'created_at',
      ],
      values: (r) => [
        r.id,
        r.user_id,
        r.content_type,
        r.content_id,
        r.title,
        r.href,
        r.image_url,
        json(r.metadata),
        stamp(r.created_at),
      ],
    },
  };
  const direct = (target: string, fields: string[], values?: (r: any) => unknown[]) => ({
    target,
    fields,
    values: values ?? ((r: any) => fields.map((f) => r[f])),
  });
  Object.assign(definitions, {
    trivia_questions: direct(
      'app_trivia_questions',
      [
        'id',
        'team_id',
        'question',
        'answer_a',
        'answer_b',
        'answer_c',
        'answer_d',
        'correct_answer',
        'explanation',
        'category',
        'verified',
        'active',
      ],
      (r) => [
        r.id,
        r.team_id,
        r.question,
        r.answer_a,
        r.answer_b,
        r.answer_c,
        r.answer_d,
        r.correct_answer,
        r.explanation,
        r.category,
        r.verified ? 1 : 0,
        r.active ? 1 : 0,
      ],
    ),
    trivia_daily_questions: direct('app_trivia_daily', [
      'id',
      'team_id',
      'question_date',
      'question_id',
    ]),
    trivia_daily_views: direct('app_trivia_views', ['user_id', 'daily_id', 'presented_at'], (r) => [
      r.user_id,
      r.daily_question_id,
      stamp(r.presented_at),
    ]),
    trivia_answers: {
      ...direct(
        'app_trivia_answers',
        [
          'id',
          'user_id',
          'daily_id',
          'question_id',
          'selected_answer',
          'correct',
          'response_time_ms',
          'points_awarded',
          'answered_at',
        ],
        (r) => [
          r.id,
          r.user_id,
          r.daily_question_id,
          r.question_id,
          r.selected_answer,
          r.correct ? 1 : 0,
          r.response_time_ms,
          r.points_awarded,
          stamp(r.answered_at),
        ],
      ),
      eligible: (r: any) => Boolean(r.daily_question_id && r.selected_answer),
    },
    trivia_stats: direct('app_trivia_stats', [
      'user_id',
      'lifetime_points',
      'weekly_points',
      'questions_answered',
      'correct_answers',
      'games_played',
      'current_streak',
      'best_streak',
    ]),
    move_the_chains_accounts: direct('app_reward_accounts', [
      'user_id',
      'current_drive_yards',
      'touchdowns',
      'lifetime_yards',
    ]),
    move_the_chains_events: direct(
      'app_reward_events',
      [
        'id',
        'user_id',
        'event_type',
        'yards',
        'source_type',
        'source_id',
        'idempotency_key',
        'created_at',
      ],
      (r) => [
        r.id,
        r.user_id,
        r.event_type,
        r.yards,
        r.source_type,
        r.source_id,
        r.idempotency_key,
        stamp(r.created_at),
      ],
    ),
    reward_definitions: direct(
      'app_reward_definitions',
      ['id', 'type', 'title', 'description', 'threshold_yards', 'discount_percent', 'active'],
      (r) => [
        r.id,
        r.type,
        r.title,
        r.description ?? '',
        r.threshold_yards,
        r.discount_percent,
        r.active ? 1 : 0,
      ],
    ),
    user_rewards: direct(
      'app_user_rewards',
      [
        'id',
        'user_id',
        'reward_definition_id',
        'status',
        'unlocked_at',
        'claimed_at',
        'redeemed_at',
        'coupon_code',
      ],
      (r) => [
        r.id,
        r.user_id,
        r.reward_definition_id,
        r.status,
        stamp(r.unlocked_at),
        stamp(r.claimed_at),
        stamp(r.redeemed_at),
        r.coupon_code,
      ],
    ),
  });
  const originalCount = (await s.rows<{ n: number }>('SELECT count(*) n FROM app_imports'))[0].n;
  // Immutable archive staging can be repeated, but conflicting row keys never
  // overwrite an earlier import. All typed inserts run only into empty targets.
  if (originalCount || (await s.rows<{ n: number }>('SELECT count(*) n FROM app_users'))[0].n)
    throw Error(
      'Import requires a fresh unserved target; retain failed target and start a new binding',
    );
  for (const table of source.tables) {
    for (let i = 0; i < table.rows.length; i++) {
      const raw = table.rows[i],
        row = JSON.parse(raw),
        rowKey = table.primaryKey.length
          ? JSON.stringify(table.primaryKey.map((k) => row[k]))
          : `ordinal:${i}`;
      const hash = await s.put({ schema: 1, table: table.name, raw });
      await s.batch([
        s.statement('INSERT INTO app_imports(source_table,row_key,object_hash) VALUES(?,?,?)', [
          table.name,
          rowKey,
          hash,
        ]),
      ]);
      archived++;
    }
  }
  for (const [name, definition] of Object.entries(definitions)) {
    const table = source.tables.find((t) => t.name === name);
    if (!table) continue;
    for (const raw of table.rows) {
      const row = JSON.parse(raw);
      if (definition.eligible && !definition.eligible(row)) continue;
      const values = definition.values(row).map((v) => (v === undefined ? null : v));
      await s.batch([
        s.statement(
          `INSERT INTO ${definition.target}(${definition.fields.join(',')}) VALUES(${values.map(() => '?').join(',')})`,
          values,
        ),
      ]);
      typed++;
    }
  }
  const users = source.tables.find((t) => t.name === 'users');
  for (const raw of users?.rows ?? []) {
    const user = JSON.parse(raw),
      profile = JSON.parse(
        source.tables
          .find((t) => t.name === 'user_profiles')
          ?.rows.find((r) => JSON.parse(r).user_id === user.id) ?? '{}',
      ),
      preferences = JSON.parse(
        source.tables
          .find((t) => t.name === 'user_preferences')
          ?.rows.find((r) => JSON.parse(r).user_id === user.id) ?? '{}',
      );
    const p: Record<string, unknown> = {
      ...preferences.preferences,
      preferredTeamId: preferences.favorite_team_abbr ?? null,
    };
    for (const name of [
      'audio_playback_speed',
      'autoplay_video',
      'reduced_motion',
      'show_around_league',
      'preferred_landing_experience',
      'push_enabled',
      'sms_enabled',
      'email_enabled',
      'show_poll_results_before_voting',
      'prediction_visibility',
      'intensity',
      'advanced_notifications',
    ])
      if (name in preferences)
        p[name.replace(/_([a-z])/g, (_m, c) => c.toUpperCase())] = preferences[name];
    await s.batch([
      s.statement(
        'INSERT INTO app_settings(user_id,profile_json,preferences_json,updated_at) VALUES(?,?,?,?)',
        [
          user.id,
          json({
            timezone: profile.timezone ?? 'America/Chicago',
            locale: profile.locale ?? 'en-US',
            onboardingCompleted: profile.onboarding_completed ?? false,
            onboardingStep: profile.onboarding_step ?? 1,
          }),
          json(p),
          stamp(preferences.updated_at ?? user.updated_at),
        ],
      ),
    ]);
    typed++;
  }
  const rows = await s.rows<{ source_table: string; row_key: string; object_hash: string }>(
    'SELECT * FROM app_imports',
  );
  for (const row of rows) {
    const retained = await s.get<{ table: string; raw: string }>(row.object_hash);
    if (
      retained.table !== row.source_table ||
      !source.tables.find((t) => t.name === retained.table)?.rows.includes(retained.raw)
    )
      throw Error('Imported archive differs');
  }
  const domains=await importRelationalDomains(s,source);
  const foreign = await s.rows('PRAGMA foreign_key_check');
  if (foreign.length || rows.length !== archived) throw Error('Import integrity check failed');
  return {
    domains,
    archivedRows: archived,
    typedRows: typed,
    typedSourceTables: Object.keys(definitions).filter((n) =>
      source.tables.some((t) => t.name === n),
    ),
    sourceTables: source.tables.length,
    sourceHash: await digest(utf8.encode(JSON.stringify(source))),
    unportedTables: source.tables
      .filter(
        (t) => !definitions[t.name] && !['user_profiles', 'user_preferences',...domains.tables].includes(t.name),
      )
      .map((t) => t.name),
    activation: 'NOT_ACTIVATED',
  };
}
