import { randomUUID } from 'node:crypto';
import { authDb } from './database';
import { tokenHash } from './crypto';
import type { AuthProviderName, NormalizedIdentity, PublicUser } from './types';

type UserRow = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  primary_email: string | null;
  email_verified: boolean;
  avatar_url: string | null;
  status: PublicUser['status'];
  created_at: Date;
  last_login_at: Date | null;
};

export const toPublicUser = (row: UserRow): PublicUser => ({
  id: row.id,
  displayName: row.display_name ?? row.primary_email?.split('@')[0] ?? 'Football Fan',
  firstName: row.first_name,
  lastName: row.last_name,
  primaryEmail: row.primary_email,
  emailVerified: row.email_verified,
  avatarUrl: row.avatar_url,
  status: row.status,
  createdAt: row.created_at.toISOString(),
  lastLoginAt: row.last_login_at?.toISOString() ?? null,
});

export async function findUserByEmail(email: string) {
  const rows = await authDb()<
    UserRow[]
  >`SELECT * FROM users WHERE lower(primary_email) = ${email.toLowerCase()} LIMIT 1`;
  return rows[0] ?? null;
}

export async function findUserById(id: string) {
  const rows = await authDb()<UserRow[]>`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  return rows[0] ?? null;
}

export async function updateUserProfile(
  userId: string,
  input: { displayName: string; primaryEmail: string },
) {
  const rows = await authDb()<UserRow[]>`
    UPDATE users SET display_name = ${input.displayName.trim()}, primary_email = ${input.primaryEmail.trim().toLowerCase()},
      email_verified = CASE WHEN lower(primary_email) = ${input.primaryEmail.trim().toLowerCase()} THEN email_verified ELSE false END,
      updated_at = now() WHERE id = ${userId} RETURNING *`;
  return rows[0];
}

export async function createEmailUser(input: {
  email: string;
  passwordHash: string;
  displayName?: string | null;
}) {
  const sql = authDb();
  return sql.begin(async (tx) => {
    const id = randomUUID();
    const email = input.email.toLowerCase();
    const rows = await tx<UserRow[]>`
      INSERT INTO users (id, display_name, primary_email, status)
      VALUES (${id}, ${input.displayName ?? null}, ${email}, 'PENDING') RETURNING *`;
    await tx`INSERT INTO user_identities
      (id, user_id, provider, provider_subject, provider_email, provider_email_verified)
      VALUES (${randomUUID()}, ${id}, 'EMAIL', ${email}, ${email}, false)`;
    await tx`INSERT INTO user_credentials (user_id, password_hash) VALUES (${id}, ${input.passwordHash})`;
    await tx`INSERT INTO user_preferences (user_id) VALUES (${id})`;
    await tx`INSERT INTO user_profiles (user_id) VALUES (${id})`;
    return rows[0];
  });
}

export async function getCredential(userId: string) {
  const rows = await authDb()<
    Array<{ password_hash: string; failed_attempts: number; locked_until: Date | null }>
  >`
    SELECT password_hash, failed_attempts, locked_until FROM user_credentials WHERE user_id = ${userId}`;
  return rows[0] ?? null;
}

export async function recordLogin(userId: string) {
  await authDb()`UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = ${userId}`;
  await authDb()`UPDATE user_credentials SET failed_attempts = 0, locked_until = null WHERE user_id = ${userId}`;
}

export async function recordFailedLogin(userId: string) {
  await authDb()`UPDATE user_credentials SET failed_attempts = failed_attempts + 1,
    locked_until = CASE WHEN failed_attempts + 1 >= 8 THEN now() + interval '15 minutes' ELSE locked_until END
    WHERE user_id = ${userId}`;
}

export async function resolveSocialUser(identity: NormalizedIdentity) {
  const sql = authDb();
  return sql.begin(async (tx) => {
    const existing = await tx<Array<UserRow & { identity_id: string }>>`
      SELECT u.*, i.id AS identity_id FROM user_identities i JOIN users u ON u.id = i.user_id
      WHERE i.provider = ${identity.provider} AND i.provider_subject = ${identity.providerSubject} LIMIT 1`;
    if (existing[0]) {
      await tx`UPDATE user_identities SET last_used_at = now(),
        provider_email = COALESCE(${identity.email},provider_email),
        provider_email_verified = provider_email_verified OR ${identity.emailVerified},
        provider_display_name = COALESCE(${identity.displayName},provider_display_name),
        updated_at = now() WHERE id = ${existing[0].identity_id}`;
      const refreshed = await tx<UserRow[]>`
        UPDATE users SET
          avatar_url = CASE
            WHEN nullif(trim(avatar_url), '') IS NULL THEN ${identity.avatarUrl ?? null}
            ELSE avatar_url
          END,
          updated_at = now()
        WHERE id = ${existing[0].id}
        RETURNING *`;
      return refreshed[0];
    }

    // Email similarity is not proof that two identities belong to the same person.
    // Existing accounts must be linked from an authenticated session instead.
    const matching = identity.email
      ? await tx<
          UserRow[]
        >`SELECT * FROM users WHERE lower(primary_email) = ${identity.email.toLowerCase()} LIMIT 1`
      : [];
    if (matching[0]) {
      throw new Error(
        'An account already uses this email. Sign in to that account and connect this provider from Security.',
      );
    }
    const userId = randomUUID();
    let user: UserRow;
    {
      const created = await tx<UserRow[]>`INSERT INTO users
        (id, display_name, first_name, last_name, primary_email, email_verified, avatar_url, status, last_login_at)
        VALUES (${userId}, ${identity.displayName}, ${identity.firstName ?? null}, ${identity.lastName ?? null},
          ${identity.email}, ${identity.emailVerified}, ${identity.avatarUrl ?? null}, 'ACTIVE', now()) RETURNING *`;
      await tx`INSERT INTO user_preferences (user_id) VALUES (${userId})`;
      await tx`INSERT INTO user_profiles (user_id) VALUES (${userId})`;
      user = created[0];
    }
    await tx`INSERT INTO user_identities
      (id, user_id, provider, provider_subject, provider_email, provider_email_verified, provider_display_name, last_used_at)
      VALUES (${randomUUID()}, ${userId}, ${identity.provider}, ${identity.providerSubject}, ${identity.email},
        ${identity.emailVerified}, ${identity.displayName}, now())`;
    return user;
  });
}

export async function linkSocialIdentity(userId: string, identity: NormalizedIdentity) {
  const sql = authDb();
  const existing = await sql<Array<{ user_id: string }>>`
    SELECT user_id FROM user_identities WHERE provider = ${identity.provider} AND provider_subject = ${identity.providerSubject} LIMIT 1`;
  if (existing[0] && existing[0].user_id !== userId)
    throw new Error('That sign-in is already linked to another account.');
  if (!existing[0])
    await sql`INSERT INTO user_identities
    (id, user_id, provider, provider_subject, provider_email, provider_email_verified, provider_display_name, last_used_at)
    VALUES (${randomUUID()}, ${userId}, ${identity.provider}, ${identity.providerSubject}, ${identity.email},
      ${identity.emailVerified}, ${identity.displayName}, now())`;
  const users = await sql<UserRow[]>`
    UPDATE users SET
      avatar_url = CASE
        WHEN nullif(trim(avatar_url), '') IS NULL THEN ${identity.avatarUrl ?? null}
        ELSE avatar_url
      END,
      updated_at = now()
    WHERE id = ${userId}
    RETURNING *`;
  return users[0] ?? null;
}

export async function unlinkIdentity(userId: string, identityId: string) {
  const count = await authDb()<
    Array<{ count: number }>
  >`SELECT count(*)::int AS count FROM user_identities WHERE user_id = ${userId}`;
  if ((count[0]?.count ?? 0) <= 1) throw new Error('You must keep at least one sign-in method.');
  const rows = await authDb()<
    Array<{ id: string }>
  >`DELETE FROM user_identities WHERE id = ${identityId} AND user_id = ${userId} RETURNING id`;
  if (!rows[0]) throw new Error('Sign-in method was not found.');
}

export async function createSession(input: {
  userId: string;
  token: string;
  deviceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  familyId?: string;
}) {
  const id = randomUUID();
  const familyId = input.familyId ?? randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await authDb().begin(async (tx) => {
    let sessionDeviceId: string | null = null;
    if (input.deviceId) {
      const devices = await tx<Array<{ id: string }>>`
        INSERT INTO devices(id,user_id,platform,name,last_seen_at)
        VALUES(${input.deviceId},${input.userId},null,${input.userAgent ?? 'D&D mobile'},now())
        ON CONFLICT(id) DO UPDATE SET last_seen_at=now(),updated_at=now()
        WHERE devices.user_id=excluded.user_id
        RETURNING id`;
      sessionDeviceId = devices[0]?.id ?? null;
    }
    await tx`INSERT INTO sessions
      (id, user_id, device_id, refresh_token_hash, token_family_id, expires_at, ip_metadata, user_agent_metadata)
      VALUES (${id}, ${input.userId}, ${sessionDeviceId}, ${tokenHash(input.token)}, ${familyId},
        ${expiresAt}, ${input.ip ?? null}, ${input.userAgent ?? null})`;
  });
  return { id, familyId, expiresAt };
}

export async function findSessionByToken(token: string) {
  const rows = await authDb()<
    Array<{
      id: string;
      user_id: string;
      token_family_id: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>
  >`
    SELECT id, user_id, token_family_id, expires_at, revoked_at FROM sessions WHERE refresh_token_hash = ${tokenHash(token)} LIMIT 1`;
  return rows[0] ?? null;
}

export async function findActiveSessionById(id: string, userId: string) {
  const rows = await authDb()<Array<{ id: string }>>`
    SELECT id FROM sessions
    WHERE id = ${id} AND user_id = ${userId} AND revoked_at IS NULL AND expires_at > now()
    LIMIT 1`;
  return rows[0] ?? null;
}

export async function rotateSession(
  oldToken: string,
  newToken: string,
  metadata: { ip?: string | null; userAgent?: string | null },
) {
  const sql = authDb();
  return sql.begin(async (tx) => {
    const active = await tx<Array<{ id: string; user_id: string; token_family_id: string }>>`
      UPDATE sessions SET revoked_at = now(), last_used_at = now()
      WHERE refresh_token_hash = ${tokenHash(oldToken)} AND revoked_at IS NULL AND expires_at > now()
      RETURNING id, user_id, token_family_id`;
    const session = active[0];
    if (!session) {
      const replay = await tx<Array<{ token_family_id: string }>>`
        SELECT token_family_id FROM sessions WHERE refresh_token_hash = ${tokenHash(oldToken)} LIMIT 1`;
      if (replay[0]) {
        await tx`UPDATE sessions SET revoked_at = coalesce(revoked_at, now()) WHERE token_family_id = ${replay[0].token_family_id}`;
      }
      return null;
    }
    const replacementId = randomUUID();
    const familyId = session.token_family_id;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await tx`INSERT INTO sessions
      (id, user_id, device_id, refresh_token_hash, token_family_id, expires_at, ip_metadata, user_agent_metadata)
      VALUES (${replacementId}, ${session.user_id}, null, ${tokenHash(newToken)}, ${familyId}, ${expiresAt}, ${metadata.ip ?? null}, ${metadata.userAgent ?? null})`;
    await tx`UPDATE sessions SET replaced_by_session_id = ${replacementId} WHERE id = ${session.id}`;
    return { id: replacementId, familyId, expiresAt, userId: session.user_id };
  });
}

export async function revokeSessionToken(token: string) {
  await authDb()`UPDATE sessions SET revoked_at = now() WHERE refresh_token_hash = ${tokenHash(token)} AND revoked_at IS NULL`;
}

export async function revokeSessionById(userId: string, sessionId: string) {
  await authDb()`UPDATE sessions SET revoked_at = now() WHERE id = ${sessionId} AND user_id = ${userId}`;
}

export async function revokeAllSessions(userId: string) {
  await authDb()`UPDATE sessions SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`;
}

export async function listSessions(userId: string) {
  return authDb()<
    Array<{
      id: string;
      createdAt: Date;
      lastUsedAt: Date;
      expiresAt: Date;
      revokedAt: Date | null;
      deviceId: string | null;
      userAgent: string | null;
    }>
  >`
    SELECT id, created_at AS "createdAt", last_used_at AS "lastUsedAt", expires_at AS "expiresAt",
      revoked_at AS "revokedAt", device_id AS "deviceId", user_agent_metadata AS "userAgent"
    FROM sessions WHERE user_id = ${userId} ORDER BY created_at DESC`;
}

export async function listIdentities(userId: string) {
  return authDb()<
    Array<{
      id: string;
      provider: AuthProviderName;
      providerEmail: string | null;
      createdAt: Date;
      lastUsedAt: Date | null;
    }>
  >`
    SELECT id, provider, provider_email AS "providerEmail", created_at AS "createdAt", last_used_at AS "lastUsedAt"
    FROM user_identities WHERE user_id = ${userId} ORDER BY created_at`;
}

export async function createOneTimeToken(
  userId: string,
  type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET',
  token: string,
  minutes: number,
) {
  await authDb()`UPDATE auth_tokens SET consumed_at = now() WHERE user_id = ${userId} AND type = ${type} AND consumed_at IS NULL`;
  await authDb()`INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at)
    VALUES (${randomUUID()}, ${userId}, ${type}, ${tokenHash(token)}, now() + (${minutes} * interval '1 minute'))`;
}

export async function consumeOneTimeToken(
  token: string,
  type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET',
) {
  const rows = await authDb()<Array<{ id: string; user_id: string }>>`
    UPDATE auth_tokens SET consumed_at = now() WHERE token_hash = ${tokenHash(token)} AND type = ${type}
      AND consumed_at IS NULL AND expires_at > now() RETURNING id, user_id`;
  return rows[0] ?? null;
}

export async function verifyUserEmail(userId: string) {
  await authDb()`UPDATE users SET email_verified = true, status = 'ACTIVE', updated_at = now() WHERE id = ${userId}`;
  await authDb()`UPDATE user_identities SET provider_email_verified = true, updated_at = now() WHERE user_id = ${userId} AND provider = 'EMAIL'`;
}

export async function changePassword(userId: string, passwordHash: string) {
  await authDb()`UPDATE user_credentials SET password_hash = ${passwordHash}, password_changed_at = now(), updated_at = now() WHERE user_id = ${userId}`;
}
