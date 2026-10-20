import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
const keys = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
  { timeoutDuration: 5000 },
);
export interface FirebaseIdentity {
  uid: string;
  projectId: string;
  expires: number;
  authTime: number;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
}
/** Key injection is for isolated signed-fixture tests, never request/environment configuration. */
export async function verifyFirebaseSignature(
  token: string,
  projectId: string,
  key: JWTVerifyGetKey = keys,
  now = new Date(),
): Promise<FirebaseIdentity> {
  if (!token || token.length > 16384) throw Error('Invalid identity token.');
  const { payload } = await jwtVerify(token, key, {
    algorithms: ['RS256'],
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    currentDate: now,
    requiredClaims: ['sub', 'exp', 'iat', 'auth_time'],
  });
  const seconds = Math.floor(now.getTime() / 1000);
  if (
    !payload.sub ||
    payload.sub.length > 128 ||
    !Number.isInteger(payload.iat) ||
    payload.iat! > seconds ||
    !Number.isInteger(payload.exp) ||
    payload.exp! <= seconds ||
    !Number.isInteger(payload.auth_time) ||
    Number(payload.auth_time) > seconds ||
    Number(payload.auth_time) < 0 ||
    Number(payload.auth_time) > payload.iat! ||
    (payload.firebase as { tenant?: string } | undefined)?.tenant
  )
    throw Error('Invalid Firebase identity claims.');
  return {
    uid: payload.sub,
    projectId,
    expires: payload.exp!,
    authTime: Number(payload.auth_time),
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: payload.email_verified === true,
    displayName: typeof payload.name === 'string' ? payload.name : undefined,
  };
}
export async function firebaseAccountRequest(
  operation: 'lookup' | 'delete',
  apiKey: string,
  idToken: string,
  request: typeof fetch = fetch,
) {
  const response = await request(
    `https://identitytoolkit.googleapis.com/v1/accounts:${operation}?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );
  if (response.status !== 200) throw Error('Firebase account validation failed.');
  const body = (await response.json()) as {
    users?: FirebaseAccount[];
    error?: { message?: string };
  };
  if (!response.ok) throw Error('Firebase account validation failed.');
  return body;
}
interface FirebaseAccount {
  localId: string;
  disabled?: boolean;
  validSince?: string;
}
export function assertFirebaseAccount(identity: FirebaseIdentity, account?: FirebaseAccount) {
  // Missing revocation metadata is a hard failure; never silently skip revocation checks.
  const since = Number(account?.validSince);
  if (
    !account ||
    account.localId !== identity.uid ||
    account.disabled ||
    !account.validSince ||
    !Number.isSafeInteger(since) ||
    since < 0 ||
    identity.authTime < since
  )
    throw Error('Firebase account is revoked or unavailable.');
}
