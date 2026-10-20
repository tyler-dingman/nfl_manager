import { Storage, digest, utf8 } from './core';
type Row = Record<string, any>;
const stamp = (row: Row | null) => {
  if (!row) return null;
  for (const key of [
    'created_at',
    'updated_at',
    'last_login_at',
    'expires_at',
    'revoked_at',
    'locked_until',
    'createdAt',
    'lastUsedAt',
    'expiresAt',
    'revokedAt',
  ])
    if (row[key] != null) row[key] = new Date(Number(row[key]));
  if ('email_verified' in row) row.email_verified = Boolean(row.email_verified);
  return row;
};
export class D1AuthRepository {
  constructor(readonly s: Storage) {}
  async one(sql: string, values: unknown[] = []) {
    return stamp((await this.s.rows<Row>(sql, values))[0] ?? null);
  }
  async findUserById(id: string) {
    return this.one('SELECT * FROM app_users WHERE id=?', [id]);
  }
  async findUserByEmail(email: string) {
    return this.one('SELECT * FROM app_users WHERE primary_email=? COLLATE NOCASE', [
      email.trim().toLowerCase(),
    ]);
  }
  emailUserPlan(input: { email: string; passwordHash: string; displayName?: string | null }) {
    const id = crypto.randomUUID(),
      now = Date.now(),
      email = input.email.trim().toLowerCase();
    return {
      id,
      statements: [
        this.s.statement(
          'INSERT INTO app_users(id,display_name,primary_email,status,created_at,updated_at) VALUES(?,?,?,?,?,?)',
          [id, input.displayName ?? null, email, 'PENDING', now, now],
        ),
        this.s.statement('INSERT INTO app_credentials(user_id,password_hash) VALUES(?,?)', [
          id,
          input.passwordHash,
        ]),
        this.s.statement(
          'INSERT INTO app_identities(id,user_id,provider,provider_subject,provider_email,created_at) VALUES(?,?,?,?,?,?)',
          [crypto.randomUUID(), id, 'EMAIL', email, email, now],
        ),
        this.s.statement('INSERT INTO app_settings(user_id,updated_at) VALUES(?,?)', [id, now]),
      ],
    };
  }
  async createEmailUser(input: {
    email: string;
    passwordHash: string;
    displayName?: string | null;
  }) {
    const plan = this.emailUserPlan(input);
    await this.s.batch(plan.statements);
    return this.findUserById(plan.id);
  }
  async updateUserProfile(id: string, input: { displayName: string; primaryEmail: string }) {
    await this.s.batch([
      this.s.statement(
        'UPDATE app_users SET display_name=?,primary_email=?,email_verified=CASE WHEN primary_email=? COLLATE NOCASE THEN email_verified ELSE 0 END,updated_at=? WHERE id=?',
        [
          input.displayName.trim(),
          input.primaryEmail.trim().toLowerCase(),
          input.primaryEmail.trim().toLowerCase(),
          Date.now(),
          id,
        ],
      ),
    ]);
    return this.findUserById(id);
  }
  async getCredential(id: string) {
    return this.one(
      'SELECT password_hash,failed_attempts,locked_until FROM app_credentials WHERE user_id=?',
      [id],
    );
  }
  async recordLogin(id: string) {
    await this.s.batch([
      this.s.statement('UPDATE app_users SET last_login_at=?,updated_at=? WHERE id=?', [
        Date.now(),
        Date.now(),
        id,
      ]),
      this.s.statement(
        'UPDATE app_credentials SET failed_attempts=0,locked_until=NULL WHERE user_id=?',
        [id],
      ),
    ]);
  }
  async recordFailedLogin(id: string) {
    await this.s.batch([
      this.s.statement(
        'UPDATE app_credentials SET failed_attempts=failed_attempts+1,locked_until=CASE WHEN failed_attempts+1>=8 THEN ? ELSE locked_until END WHERE user_id=?',
        [Date.now() + 900000, id],
      ),
    ]);
  }
  async resolveSocialUser(identity: Row) {
    const [match] = await this.s.rows<Row>(
      'SELECT user_id FROM app_identities WHERE provider=? AND provider_subject=?',
      [identity.provider, identity.providerSubject],
    );
    if (match) {
      return this.linkSocialIdentity(match.user_id, identity);
    }
    if (identity.email && (await this.findUserByEmail(identity.email)))
      throw Error(
        'An account already uses this email. Sign in to that account and connect this provider from Security.',
      );
    const id = crypto.randomUUID(),
      now = Date.now();
    try {
      await this.s.batch([
        this.s.statement(
          'INSERT INTO app_users(id,display_name,first_name,last_name,primary_email,email_verified,avatar_url,status,created_at,updated_at,last_login_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
          [
            id,
            identity.displayName ?? null,
            identity.firstName ?? null,
            identity.lastName ?? null,
            identity.email ?? null,
            identity.emailVerified ? 1 : 0,
            identity.avatarUrl ?? null,
            'ACTIVE',
            now,
            now,
            now,
          ],
        ),
        this.s.statement('INSERT INTO app_settings(user_id,updated_at) VALUES(?,?)', [id, now]),
        this.identityStatement(id, identity),
      ]);
    } catch (error) {
      const [winner] = await this.s.rows<Row>(
        'SELECT user_id FROM app_identities WHERE provider=? AND provider_subject=?',
        [identity.provider, identity.providerSubject],
      );
      if (winner) return this.findUserById(winner.user_id);
      throw error;
    }
    return this.findUserById(id);
  }
  identityStatement(id: string, identity: Row) {
    return this.s.statement(
      'INSERT INTO app_identities(id,user_id,provider,provider_subject,provider_email,provider_email_verified,provider_display_name,created_at,last_used_at) VALUES(?,?,?,?,?,?,?,?,?)',
      [
        crypto.randomUUID(),
        id,
        identity.provider,
        identity.providerSubject,
        identity.email ?? null,
        identity.emailVerified ? 1 : 0,
        identity.displayName ?? null,
        Date.now(),
        Date.now(),
      ],
    );
  }
  async linkSocialIdentity(id: string, identity: Row) {
    const [existing] = await this.s.rows<Row>(
      'SELECT user_id FROM app_identities WHERE provider=? AND provider_subject=?',
      [identity.provider, identity.providerSubject],
    );
    if (existing && existing.user_id !== id)
      throw Error('That sign-in is already linked to another account.');
    await this.s.batch([
      existing
        ? this.s.statement(
            'UPDATE app_identities SET last_used_at=?,provider_email=coalesce(?,provider_email),provider_email_verified=provider_email_verified OR ?,provider_display_name=coalesce(?,provider_display_name) WHERE provider=? AND provider_subject=? AND user_id=?',
            [
              Date.now(),
              identity.email ?? null,
              identity.emailVerified ? 1 : 0,
              identity.displayName ?? null,
              identity.provider,
              identity.providerSubject,
              id,
            ],
          )
        : this.identityStatement(id, identity),
      this.s.statement(
        "UPDATE app_users SET avatar_url=CASE WHEN trim(coalesce(avatar_url,''))='' THEN ? ELSE avatar_url END,updated_at=? WHERE id=?",
        [identity.avatarUrl ?? null, Date.now(), id],
      ),
    ]);
    return this.findUserById(id);
  }
  async unlinkIdentity(id: string, identityId: string) {
    const r = await this.s.batch([
      this.s.statement(
        'DELETE FROM app_identities WHERE id=? AND user_id=? AND (SELECT count(*) FROM app_identities WHERE user_id=?)>1',
        [identityId, id, id],
      ),
    ]);
    if (!r[0].meta.changes)
      throw Error('Keep at least one sign-in method; identity must belong to this account.');
  }
  async createSession(input: Row) {
    const id = crypto.randomUUID(),
      familyId = input.familyId ?? crypto.randomUUID(),
      now = Date.now(),
      expiresAt = input.expiresAt ?? new Date(now + 30 * 86400000),
      statements = [];
    if (
      !(expiresAt instanceof Date) ||
      !Number.isFinite(expiresAt.getTime()) ||
      expiresAt.getTime() <= now ||
      expiresAt.getTime() > now + 30 * 86400000
    )
      throw Error('Invalid session expiry');
    if (input.previousToken)
      statements.push(
        this.s.statement(
          'UPDATE app_sessions SET revoked_at=? WHERE refresh_token_hash=? AND user_id=? AND revoked_at IS NULL',
          [now, await digest(utf8.encode(input.previousToken)), input.userId],
        ),
      );
    if (input.deviceId)
      statements.push(
        this.s.statement(
          'INSERT INTO app_devices(id,user_id,name,last_seen_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen_at=excluded.last_seen_at WHERE app_devices.user_id=excluded.user_id',
          [input.deviceId, input.userId, input.userAgent ?? null, now],
        ),
      );
    statements.push(
      this.s.statement(
        'INSERT INTO app_sessions(id,user_id,device_id,refresh_token_hash,token_family_id,expires_at,created_at,last_used_at,ip_metadata,user_agent_metadata) VALUES(?,?,(SELECT id FROM app_devices WHERE id=? AND user_id=?),?,?,?,?,?,?,?)',
        [
          id,
          input.userId,
          input.deviceId ?? null,
          input.userId,
          await digest(utf8.encode(input.token)),
          familyId,
          expiresAt.getTime(),
          now,
          now,
          input.ip ?? null,
          input.userAgent ?? null,
        ],
      ),
    );
    if (input.firebase)
      statements.push(
        this.s.statement(
          'INSERT INTO app_firebase_sessions(session_id,user_id,identity_hash,id_token_ciphertext) VALUES(?,?,?,?)',
          [id, input.userId, input.firebase.identityHash, input.firebase.idTokenCiphertext],
        ),
      );
    await this.s.batch(statements);
    return { id, familyId, expiresAt };
  }
  async findSessionByToken(token: string) {
    return this.one(
      'SELECT id,user_id,token_family_id,expires_at,revoked_at FROM app_sessions WHERE refresh_token_hash=?',
      [await digest(utf8.encode(token))],
    );
  }
  async findActiveSessionById(id: string, userId: string) {
    return this.one(
      'SELECT id FROM app_sessions WHERE id=? AND user_id=? AND revoked_at IS NULL AND expires_at>?',
      [id, userId, Date.now()],
    );
  }
  async rotateSession(oldToken: string, newToken: string, metadata: Row) {
    const oldHash = await digest(utf8.encode(oldToken)),
      hash = await digest(utf8.encode(newToken)),
      id = crypto.randomUUID(),
      now = Date.now(),
      expiresAt = new Date(now + 30 * 86400000);
    await this.s.batch([
      this.s.statement(
        'UPDATE app_sessions SET revoked_at=?,last_used_at=?,replaced_by_session_id=? WHERE refresh_token_hash=? AND revoked_at IS NULL AND expires_at>?',
        [now, now, id, oldHash, now],
      ),
      this.s.statement(
        'INSERT INTO app_sessions(id,user_id,refresh_token_hash,token_family_id,expires_at,created_at,last_used_at,ip_metadata,user_agent_metadata) SELECT ?,user_id,?,token_family_id,?,?,?,?,? FROM app_sessions WHERE refresh_token_hash=? AND replaced_by_session_id=?',
        [
          id,
          hash,
          expiresAt.getTime(),
          now,
          now,
          metadata.ip ?? null,
          metadata.userAgent ?? null,
          oldHash,
          id,
        ],
      ),
    ]);
    const row = await this.one('SELECT user_id,token_family_id FROM app_sessions WHERE id=?', [id]);
    if (!row) {
      await this.s.batch([
        this.s.statement(
          'UPDATE app_sessions SET revoked_at=coalesce(revoked_at,?) WHERE token_family_id IN(SELECT token_family_id FROM app_sessions WHERE refresh_token_hash=?)',
          [now, oldHash],
        ),
      ]);
      return null;
    }
    return { id, familyId: row.token_family_id, expiresAt, userId: row.user_id };
  }
  async revokeSessionToken(token: string) {
    await this.s.batch([
      this.s.statement(
        'UPDATE app_sessions SET revoked_at=? WHERE refresh_token_hash=? AND revoked_at IS NULL',
        [Date.now(), await digest(utf8.encode(token))],
      ),
    ]);
  }
  async revokeSessionById(id: string, session: string) {
    await this.s.batch([
      this.s.statement('UPDATE app_sessions SET revoked_at=? WHERE id=? AND user_id=?', [
        Date.now(),
        session,
        id,
      ]),
    ]);
  }
  async revokeAllSessions(id: string) {
    await this.s.batch([
      this.s.statement(
        'UPDATE app_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',
        [Date.now(), id],
      ),
    ]);
  }
  async listSessions(id: string) {
    return (
      await this.s.rows<Row>(
        'SELECT id,created_at AS createdAt,last_used_at AS lastUsedAt,expires_at AS expiresAt,revoked_at AS revokedAt,device_id AS deviceId,user_agent_metadata AS userAgent FROM app_sessions WHERE user_id=? ORDER BY created_at DESC',
        [id],
      )
    ).map(stamp);
  }
  async listIdentities(id: string) {
    return (
      await this.s.rows<Row>(
        'SELECT id,provider,provider_email AS providerEmail,created_at AS createdAt,last_used_at AS lastUsedAt FROM app_identities WHERE user_id=? ORDER BY created_at',
        [id],
      )
    ).map(stamp);
  }
  tokenStatements(id: string, type: string, tokenHash: string, minutes: number) {
    return [
      this.s.statement(
        'UPDATE app_tokens SET consumed_at=? WHERE user_id=? AND type=? AND consumed_at IS NULL',
        [Date.now(), id, type],
      ),
      this.s.statement(
        'INSERT INTO app_tokens(id,user_id,type,token_hash,expires_at) VALUES(?,?,?,?,?)',
        [crypto.randomUUID(), id, type, tokenHash, Date.now() + minutes * 60000],
      ),
    ];
  }
  async createOneTimeToken(id: string, type: string, token: string, minutes: number) {
    await this.s.batch(this.tokenStatements(id, type, await digest(utf8.encode(token)), minutes));
  }
  async consumeOneTimeToken(token: string, type: string) {
    return this.one(
      'UPDATE app_tokens SET consumed_at=? WHERE token_hash=? AND type=? AND consumed_at IS NULL AND expires_at>? RETURNING id,user_id',
      [Date.now(), await digest(utf8.encode(token)), type, Date.now()],
    );
  }
  async verifyUserEmail(id: string) {
    await this.s.batch([
      this.s.statement(
        "UPDATE app_users SET email_verified=1,status='ACTIVE',updated_at=? WHERE id=?",
        [Date.now(), id],
      ),
      this.s.statement(
        "UPDATE app_identities SET provider_email_verified=1 WHERE user_id=? AND provider='EMAIL'",
        [id],
      ),
    ]);
  }
  async changePassword(id: string, hash: string) {
    await this.s.batch([
      this.s.statement(
        'UPDATE app_credentials SET password_hash=?,password_changed_at=? WHERE user_id=?',
        [hash, Date.now(), id],
      ),
    ]);
  }
  async resetPassword(token: string, encoded: string) {
    const nonce = crypto.randomUUID(),
      now = Date.now();
    await this.s.batch([
      this.s.statement(
        "UPDATE app_tokens SET consumed_at=?,consume_nonce=? WHERE token_hash=? AND type='PASSWORD_RESET' AND consumed_at IS NULL AND expires_at>?",
        [now, nonce, await digest(utf8.encode(token)), now],
      ),
      this.s.guard(nonce),
      this.s.statement(
        'UPDATE app_credentials SET password_hash=?,password_changed_at=? WHERE user_id=(SELECT user_id FROM app_tokens WHERE consume_nonce=?)',
        [encoded, now, nonce],
      ),
      this.s.guard(nonce + 'credential'),
      this.s.statement(
        'UPDATE app_sessions SET revoked_at=? WHERE user_id=(SELECT user_id FROM app_tokens WHERE consume_nonce=?) AND revoked_at IS NULL',
        [now, nonce],
      ),
      this.s.unguard(nonce),
      this.s.unguard(nonce + 'credential'),
    ]);
  }
  async confirmEmail(token: string) {
    const nonce = crypto.randomUUID(),
      now = Date.now();
    try {
      await this.s.batch([
        this.s.statement(
          "UPDATE app_tokens SET consumed_at=?,consume_nonce=? WHERE token_hash=? AND type='EMAIL_VERIFICATION' AND consumed_at IS NULL AND expires_at>?",
          [now, nonce, await digest(utf8.encode(token)), now],
        ),
        this.s.guard(nonce),
        this.s.statement(
          "UPDATE app_users SET email_verified=1,status=CASE WHEN status='PENDING' THEN 'ACTIVE' ELSE status END,updated_at=? WHERE id=(SELECT user_id FROM app_tokens WHERE consume_nonce=?)",
          [now, nonce],
        ),
        this.s.guard(nonce + 'user'),
        this.s.statement(
          "UPDATE app_identities SET provider_email_verified=1 WHERE provider='EMAIL' AND user_id=(SELECT user_id FROM app_tokens WHERE consume_nonce=?)",
          [nonce],
        ),
        this.s.unguard(nonce),
        this.s.unguard(nonce + 'user'),
      ]);
    } catch (error) {
      if (/CHECK constraint failed|app_assertions/.test(String(error)))
        throw Error('This verification link is invalid or expired.');
      throw error;
    }
  }
}
