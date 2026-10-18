import { Storage } from './core';
import { D1AuthRepository } from './auth';
import { DEFAULT_PREFERENCES } from '../../src/server/user/types';
export class D1UserRepository {
  constructor(readonly s: Storage) {}
  async ensureUserSettings(id: string) {
    await this.s.batch([
      this.s.statement(
        'INSERT INTO app_settings(user_id,updated_at) VALUES(?,?) ON CONFLICT DO NOTHING',
        [id, Date.now()],
      ),
    ]);
  }
  async getProfile(id: string) {
    const u = await new D1AuthRepository(this.s).findUserById(id);
    if (!u) return undefined;
    const [row] = await this.s.rows<{ profile_json: string; updated_at: number }>(
      'SELECT profile_json,updated_at FROM app_settings WHERE user_id=?',
      [id],
    );
    const p = JSON.parse(row?.profile_json ?? '{}');
    return {
      id: u.id,
      displayName: u.display_name,
      firstName: u.first_name,
      lastName: u.last_name,
      primaryEmail: u.primary_email,
      emailVerified: u.email_verified,
      avatarUrl: u.avatar_url,
      timezone: 'America/Chicago',
      locale: 'en-US',
      onboardingCompleted: false,
      onboardingStep: 1,
      ...p,
      createdAt: u.created_at,
      updatedAt: new Date(row?.updated_at ?? u.updated_at),
    };
  }
  async updateProfile(id: string, input: Record<string, unknown>) {
    await this.s.batch([
      this.s.statement(
        'UPDATE app_users SET display_name=coalesce(?,display_name),first_name=CASE WHEN ? THEN ? ELSE first_name END,last_name=CASE WHEN ? THEN ? ELSE last_name END,avatar_url=CASE WHEN ? THEN ? ELSE avatar_url END,updated_at=? WHERE id=?',
        [
          input.displayName ?? null,
          input.firstName !== undefined ? 1 : 0,
          input.firstName ?? null,
          input.lastName !== undefined ? 1 : 0,
          input.lastName ?? null,
          input.avatarUrl !== undefined ? 1 : 0,
          input.avatarUrl ?? null,
          Date.now(),
          id,
        ],
      ),
      this.s.statement(
        'UPDATE app_settings SET profile_json=json_patch(profile_json,?),updated_at=? WHERE user_id=?',
        [
          JSON.stringify({
            ...(input.timezone ? { timezone: input.timezone } : {}),
            ...(input.locale ? { locale: input.locale } : {}),
          }),
          Date.now(),
          id,
        ],
      ),
    ]);
    return this.getProfile(id);
  }
  async getPreferences(id: string) {
    const [row] = await this.s.rows<{ preferences_json: string }>(
      'SELECT preferences_json FROM app_settings WHERE user_id=?',
      [id],
    );
    if (!row) throw Error('User settings missing; migration is incomplete');
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(row.preferences_json) };
  }
  async updatePreferences(id: string, input: Record<string, unknown>) {
    await this.s.batch([
      this.s.statement(
        'UPDATE app_settings SET preferences_json=json_patch(preferences_json,?),updated_at=? WHERE user_id=?',
        [JSON.stringify(input), Date.now(), id],
      ),
    ]);
    return this.getPreferences(id);
  }
  async getOnboarding(id: string) {
    const p = await this.getProfile(id);
    return { completed: p?.onboardingCompleted ?? false, step: p?.onboardingStep ?? 1 };
  }
  async updateOnboarding(id: string, step: number, completed: boolean) {
    await this.s.batch([
      this.s.statement(
        'UPDATE app_settings SET profile_json=json_patch(profile_json,?),updated_at=? WHERE user_id=?',
        [JSON.stringify({ onboardingCompleted: completed, onboardingStep: step }), Date.now(), id],
      ),
    ]);
    return this.getOnboarding(id);
  }
  async listTeamFollows(id: string) {
    const rows = await this.s.rows<any>(
      'SELECT id,team_id AS teamId,is_primary AS isPrimary,notification_level AS notificationLevel,created_at AS createdAt FROM app_team_follows WHERE user_id=? ORDER BY is_primary DESC,created_at',
      [id],
    );
    return rows.map((r) => ({
      ...r,
      isPrimary: Boolean(r.isPrimary),
      createdAt: new Date(r.createdAt),
    }));
  }
  async followTeam(id: string, team: string, level = 'DEFAULT') {
    await this.s.batch([
      this.s.statement(
        'INSERT INTO app_team_follows(id,user_id,team_id,notification_level,created_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,team_id) DO UPDATE SET notification_level=excluded.notification_level',
        [crypto.randomUUID(), id, team, level, Date.now()],
      ),
    ]);
    return this.listTeamFollows(id);
  }
  async setPrimaryTeam(id: string, team: string) {
    await this.s.batch([
      this.s.statement(
        'UPDATE app_team_follows SET is_primary=0 WHERE user_id=? AND is_primary=1',
        [id],
      ),
      this.s.statement(
        'INSERT INTO app_team_follows(id,user_id,team_id,is_primary,created_at) VALUES(?,?,?,1,?) ON CONFLICT(user_id,team_id) DO UPDATE SET is_primary=1',
        [crypto.randomUUID(), id, team, Date.now()],
      ),
      this.s.statement(
        'UPDATE app_settings SET preferences_json=json_patch(preferences_json,?),updated_at=? WHERE user_id=?',
        [JSON.stringify({ preferredTeamId: team }), Date.now(), id],
      ),
    ]);
    return this.listTeamFollows(id);
  }
  async unfollowTeam(id: string, team: string) {
    await this.s.batch([
      this.s.statement('DELETE FROM app_team_follows WHERE user_id=? AND team_id=?', [id, team]),
      this.s.statement(
        "UPDATE app_settings SET preferences_json=json_set(preferences_json,'$.preferredTeamId',NULL),updated_at=? WHERE user_id=? AND json_extract(preferences_json,'$.preferredTeamId')=?",
        [Date.now(), id, team],
      ),
    ]);
  }
  async listSavedContent(id: string) {
    const rows = await this.s.rows<any>(
      'SELECT id,content_type AS contentType,content_id AS contentId,title,href,image_url AS imageUrl,metadata_json,metadata_hash,created_at AS createdAt FROM app_saved_content WHERE user_id=? ORDER BY created_at DESC',
      [id],
    );
    return Promise.all(
      rows.map(async (r) => {
        let metadata = JSON.parse(r.metadata_json);
        if (r.metadata_hash) {
          const envelope = await this.s.get<{
            schema: number;
            owner: string;
            contentType: string;
            contentId: string;
            metadata: unknown;
          }>(r.metadata_hash);
          if (
            envelope.schema !== 1 ||
            envelope.owner !== id ||
            envelope.contentType !== r.contentType ||
            envelope.contentId !== r.contentId
          )
            throw Error('Saved metadata ownership mismatch');
          metadata = envelope.metadata;
        }
        const { metadata_json, metadata_hash, ...rest } = r;
        return { ...rest, metadata, createdAt: new Date(r.createdAt) };
      }),
    );
  }
  async saveContent(id: string, input: any) {
    let raw = JSON.stringify(input.metadata ?? {});
    let hash: string | null = null;
    if (new TextEncoder().encode(raw).length > 32000) {
      hash = await this.s.put({
        schema: 1,
        owner: id,
        contentType: input.contentType,
        contentId: input.contentId,
        metadata: input.metadata,
      });
      raw = '{}';
    }
    const rows = await this.s.rows<any>(
      'INSERT INTO app_saved_content(id,user_id,content_type,content_id,title,href,image_url,metadata_json,metadata_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,content_type,content_id) DO UPDATE SET title=excluded.title,href=excluded.href,image_url=excluded.image_url,metadata_json=excluded.metadata_json,metadata_hash=excluded.metadata_hash RETURNING id',
      [
        crypto.randomUUID(),
        id,
        input.contentType,
        input.contentId,
        input.title,
        input.href ?? null,
        input.imageUrl ?? null,
        raw,
        hash,
        Date.now(),
      ],
    );
    return rows[0] ?? null;
  }
  async unsaveContent(id: string, type: string, content: string) {
    await this.s.batch([
      this.s.statement(
        'DELETE FROM app_saved_content WHERE user_id=? AND content_type=? AND content_id=?',
        [id, type, content],
      ),
    ]);
  }
}
