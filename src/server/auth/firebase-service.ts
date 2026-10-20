import { authStage, authStageSync } from './performance';
import { createHmac } from 'node:crypto';
import {
  applicationStorage,
  applicationBackend,
  applicationEnvironment,
} from '../persistence/bindings';
import { digest, utf8 } from '../../../packages/storage/core';
import { requireAuthConfig } from './config';
import { firebaseConfiguration, firebaseSelected } from './firebase-config';
import {
  verifyFirebaseSignature,
  firebaseAccountRequest,
  assertFirebaseAccount,
  type FirebaseIdentity,
} from './firebase-token';
import { encryptSecret, decryptSecret, secureToken } from './crypto';
import { D1AuthRepository } from '../../../packages/storage/auth';
import { signSessionAccessToken } from './service';
import { toPublicUser } from './repository';
const storage = () => applicationStorage('D1_USERS');
export const firebaseIdentityHash = (identity: FirebaseIdentity) =>
  createHmac('sha256', requireAuthConfig().AUTH_JWT_SECRET)
    .update(`firebase:${identity.projectId}:${identity.uid}`)
    .digest('hex');
async function checkTombstone(identity: FirebaseIdentity) {
  const [row] = await storage().rows<{ revoked_before: number; deleted: number }>(
    'SELECT revoked_before,deleted FROM app_firebase_revocations WHERE identity_hash=?',
    [firebaseIdentityHash(identity)],
  );
  if (row && (row.deleted || identity.authTime <= row.revoked_before))
    throw Error('Sign in again.');
}
async function verifiedProviderIdentity(token: string) {
  const configuration = firebaseConfiguration();
  const identity = await verifyFirebaseSignature(token, configuration.projectId);
  const body = await authStage('provider.lookup', () =>
    firebaseAccountRequest('lookup', configuration.apiKey, token),
  );
  assertFirebaseAccount(identity, body.users?.[0]);
  return identity;
}
export async function verifiedFirebaseIdentity(token: string) {
  const identity = await verifiedProviderIdentity(token);
  await authStage('d1.revocation', () => checkTombstone(identity));
  return identity;
}
export function coalescedFirebaseSessions() {
  const env = applicationEnvironment();
  return (
    firebaseSelected() &&
    applicationBackend() === 'd1' &&
    env.APP_RUNTIME === 'node' &&
    env.DD_COALESCED_FIREBASE_SESSION === 'true'
  );
}
export async function firebaseSessionUser(input: {
  refreshToken?: string;
  sessionId?: string;
  userId?: string;
}) {
  try {
    const repo = new D1AuthRepository(storage());
    const context = await repo.firebaseSessionContext(
      input.refreshToken !== undefined
        ? { tokenHash: await digest(utf8.encode(input.refreshToken)) }
        : input,
    );
    if (!context) return null;
    const identity = await verifiedProviderIdentity(decryptSecret(context.id_token_ciphertext));
    return await repo.verifiedFirebaseSessionUser({
      sessionId: context.session_id,
      userId: context.user_id,
      identityHash: firebaseIdentityHash(identity),
      providerSubject: `${identity.projectId}:${identity.uid}`,
      authTime: identity.authTime,
      ciphertext: context.id_token_ciphertext,
    });
  } catch {
    return null;
  }
}
export async function firebaseSessionValid(sessionId: string, userId: string) {
  if (!firebaseSelected()) return true;
  try {
    const [row] = await storage().rows<{ id_token_ciphertext: string; identity_hash: string }>(
      'SELECT f.id_token_ciphertext,f.identity_hash FROM app_firebase_sessions f JOIN app_identities i ON i.user_id=f.user_id AND i.provider=? WHERE f.session_id=? AND f.user_id=?',
      ['FIREBASE', sessionId, userId],
    );
    if (!row) return false;
    const identity = await verifiedFirebaseIdentity(decryptSecret(row.id_token_ciphertext));
    const [mapping] = await storage().rows(
      'SELECT id FROM app_identities WHERE user_id=? AND provider=? AND provider_subject=?',
      [userId, 'FIREBASE', `${identity.projectId}:${identity.uid}`],
    );
    return Boolean(mapping && row.identity_hash === firebaseIdentityHash(identity));
  } catch {
    return false;
  }
}
export async function exchangeFirebaseSession(
  token: string,
  previous: string | undefined,
  metadata: { deviceId?: string; ip?: string | null; userAgent?: string | null; mobile?: boolean },
) {
  const identity = await verifiedFirebaseIdentity(token);
  const repo = new D1AuthRepository(storage());
  const user = await authStage('d1.provision', () =>
    repo.resolveSocialUser({
      provider: 'FIREBASE',
      providerSubject: `${identity.projectId}:${identity.uid}`,
      email: identity.email,
      emailVerified: identity.emailVerified,
      displayName: identity.displayName,
    }),
  );
  if (!user || !['ACTIVE', 'PENDING'].includes(user.status)) throw Error('Account unavailable.');
  const expiresAt = new Date(identity.expires * 1000),
    refreshToken = secureToken(48);
  const binding = {
    identityHash: firebaseIdentityHash(identity),
    idTokenCiphertext: authStageSync('session.encrypt', () => encryptSecret(token)),
  };
  // One fenced atomic batch: revoke only this user's previous session, insert the
  // already-capped session and its provider association. No transient unbound session.
  const session = await authStage('session.create', () =>
    repo.createSession({
      userId: user.id,
      token: refreshToken,
      ...metadata,
      expiresAt,
      firebase: binding,
      previousToken: previous,
    }),
  );
  const accessToken = metadata.mobile
    ? await signSessionAccessToken(session.id, user.id)
    : undefined;
  return {
    sessionId: session.id,
    refreshToken,
    accessToken,
    expiresAt,
    user: toPublicUser(user as Parameters<typeof toPublicUser>[0]),
  };
}

export async function revokeFirebaseUserSessions(userId: string) {
  if (!firebaseSelected()) return;
  const rows = await storage().rows<{ identity_hash: string }>(
    'SELECT DISTINCT identity_hash FROM app_firebase_sessions WHERE user_id=?',
    [userId],
  );
  for (const row of rows)
    await storage().batch([
      storage().statement(
        'INSERT INTO app_firebase_revocations(identity_hash,revoked_before) VALUES(?,?) ON CONFLICT(identity_hash) DO UPDATE SET revoked_before=max(revoked_before,excluded.revoked_before)',
        [row.identity_hash, Math.floor(Date.now() / 1000)],
      ),
    ]);
}
/** Called only after recent verified identity AND current application user authorization. */
export async function deleteFirebaseIdentity(userId: string, token: string) {
  const identity = await verifiedFirebaseIdentity(token);
  if (Math.floor(Date.now() / 1000) - identity.authTime > 300)
    throw Error('Sign out and sign in again before deleting your account.');
  const s = storage(),
    hash = firebaseIdentityHash(identity);
  const [mapping] = await s.rows(
    'SELECT id FROM app_identities WHERE user_id=? AND provider=? AND provider_subject=?',
    [userId, 'FIREBASE', `${identity.projectId}:${identity.uid}`],
  );
  if (!mapping) throw Error('Identity does not belong to this account.');
  await s.batch([
    s.statement(
      'INSERT INTO app_firebase_deletions(identity_hash,user_id,requested_at) VALUES(?,?,?) ON CONFLICT(identity_hash) DO NOTHING',
      [hash, userId, Date.now()],
    ),
  ]);
  await firebaseAccountRequest('delete', firebaseConfiguration().apiKey, token);
  await s.batch([
    s.statement('UPDATE app_firebase_deletions SET provider_deleted=1 WHERE identity_hash=?', [
      hash,
    ]),
    s.statement(
      'INSERT INTO app_firebase_revocations(identity_hash,deleted) VALUES(?,1) ON CONFLICT(identity_hash) DO UPDATE SET deleted=1',
      [hash],
    ),
    s.statement('UPDATE app_sessions SET revoked_at=? WHERE user_id=?', [Date.now(), userId]),
  ]);
  return hash;
}
export async function finishFirebaseErasure(hash: string) {
  await storage().batch([
    storage().statement(
      'UPDATE app_firebase_deletions SET erasure_requested=1,user_id=NULL WHERE identity_hash=?',
      [hash],
    ),
  ]);
}

/** Owner-only recovery entry point. No HTTP route calls this automatically.
 * Replays only a durable, acknowledged provider deletion; never deletes Firebase accounts. */
export async function resumeFirebaseErasures() {
  const rows = await storage().rows<{ identity_hash: string; user_id: string }>(
    'SELECT identity_hash,user_id FROM app_firebase_deletions WHERE provider_deleted=1 AND erasure_requested=0 AND user_id IS NOT NULL LIMIT 10',
  );
  const { deleteUserAccount } = await import('../user/account-repository');
  for (const row of rows) {
    await deleteUserAccount(row.user_id);
    await finishFirebaseErasure(row.identity_hash);
  }
  return { resumed: rows.length };
}
