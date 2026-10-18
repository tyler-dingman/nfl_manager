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
    { target: string; fields: string[]; values: (r: any) => unknown[] }
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
      const row = JSON.parse(raw),
        values = definition.values(row).map((v) => (v === undefined ? null : v));
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
  const foreign = await s.rows('PRAGMA foreign_key_check');
  if (foreign.length || rows.length !== archived) throw Error('Import integrity check failed');
  return {
    archivedRows: archived,
    typedRows: typed,
    typedSourceTables: Object.keys(definitions).filter((n) =>
      source.tables.some((t) => t.name === n),
    ),
    sourceTables: source.tables.length,
    sourceHash: await digest(utf8.encode(JSON.stringify(source))),
    unportedTables: source.tables
      .filter(
        (t) => !definitions[t.name] && !['user_profiles', 'user_preferences'].includes(t.name),
      )
      .map((t) => t.name),
    activation: 'NOT_ACTIVATED',
  };
}
