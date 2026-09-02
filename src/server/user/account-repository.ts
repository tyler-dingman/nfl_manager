import { randomUUID } from 'node:crypto';

import { authDb } from '@/server/auth/database';
import { recordSecurityEvent } from '@/server/security/audit';
import { listSavedContent, listPredictions } from './content-repository';
import { getPreferences, listTeamFollows } from './repository';

export async function exportUserAccount(userId: string) {
  const sql = authDb();
  const [profile, preferences, teamFollows, savedContent, predictions, notifications, consents] = await Promise.all([
    sql<Array<Record<string, unknown>>>`SELECT id, display_name AS "displayName", first_name AS "firstName", last_name AS "lastName", primary_email AS "primaryEmail", email_verified AS "emailVerified", avatar_url AS "avatarUrl", status, created_at AS "createdAt" FROM users WHERE id = ${userId}`,
    getPreferences(userId),
    listTeamFollows(userId),
    listSavedContent(userId),
    listPredictions(userId),
    sql<Array<Record<string, unknown>>>`SELECT id, title, body, deep_link AS "deepLink", created_at AS "createdAt", read_at AS "readAt" FROM user_notifications WHERE user_id = ${userId} ORDER BY created_at DESC`,
    sql<Array<Record<string, unknown>>>`SELECT channel, consent_type AS "consentType", policy_version AS "policyVersion", granted_at AS "grantedAt", revoked_at AS "revokedAt", source FROM user_consents WHERE user_id = ${userId} ORDER BY granted_at DESC`,
  ]);
  await recordSecurityEvent(userId, 'ACCOUNT_EXPORT_REQUESTED');
  return { exportedAt: new Date().toISOString(), profile: profile[0] ?? null, preferences, teamFollows, savedContent, predictions, notifications, consents };
}

export async function deleteUserAccount(userId: string) {
  const sql = authDb();
  await sql.begin(async (tx) => {
    await tx`INSERT INTO security_audit_events (id, user_id, event_type, actor_type, metadata) VALUES (${randomUUID()}, ${userId}, 'ACCOUNT_DELETED', 'USER', ${tx.json({ reason: 'user_requested' })})`;
    await tx`DELETE FROM users WHERE id = ${userId}`;
  });
}