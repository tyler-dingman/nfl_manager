import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';
import { authConfig } from '../config';
import type { AuthProviderAdapter } from '../types';
import type { NormalizedIdentity } from '../types';

const jwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

export function normalizeAppleIdentity(
  payload: Record<string, unknown>,
  suppliedUser?: string,
): NormalizedIdentity {
  if (typeof payload.sub !== 'string' || !payload.sub)
    throw new Error('Apple identity subject is missing.');
  let supplied: { name?: { firstName?: string; lastName?: string } } = {};
  try {
    supplied = suppliedUser ? (JSON.parse(suppliedUser) as typeof supplied) : {};
  } catch {
    /* Apple user data is optional and only normally supplied on first authorization. */
  }
  const firstName = supplied.name?.firstName?.trim() || null;
  const lastName = supplied.name?.lastName?.trim() || null;
  const tokenEmail = typeof payload.email === 'string' ? payload.email : null;
  return {
    provider: 'APPLE',
    providerSubject: payload.sub,
    email: tokenEmail,
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    displayName: [firstName, lastName].filter(Boolean).join(' ') || null,
    firstName,
    lastName,
  };
}

async function appleClientSecret() {
  const { APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY } = authConfig;
  if (!APPLE_CLIENT_ID || !APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY)
    throw new Error('Apple authentication is not configured.');
  const key = await importPKCS8(APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: APPLE_KEY_ID })
    .setIssuer(APPLE_TEAM_ID)
    .setSubject(APPLE_CLIENT_ID)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

export const appleProvider: AuthProviderAdapter = {
  beginAuthentication({ state, nonce, redirectUri }) {
    if (!authConfig.APPLE_CLIENT_ID) throw new Error('Apple authentication is not configured.');
    const query = new URLSearchParams({
      client_id: authConfig.APPLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code id_token',
      response_mode: 'form_post',
      scope: 'name email',
      state,
      nonce,
    });
    return `https://appleid.apple.com/auth/authorize?${query}`;
  },
  async validateCallback({ code, idToken, nonce, redirectUri, user, codeVerifier }) {
    const audiences = [authConfig.APPLE_CLIENT_ID, authConfig.APPLE_IOS_CLIENT_ID].filter(
      (value): value is string => Boolean(value),
    );
    if (!audiences.length) throw new Error('Apple authentication is not configured.');
    let token = idToken;
    if (!token && code) {
      const webClientId = authConfig.APPLE_CLIENT_ID;
      if (!webClientId) throw new Error('Apple web authentication is not configured.');
      const response = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
          client_id: webClientId,
          client_secret: await appleClientSecret(),
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      if (!response.ok) throw new Error('Apple token exchange failed.');
      token = ((await response.json()) as { id_token?: string }).id_token;
    }
    if (!token) throw new Error('Apple identity token is missing.');
    const { payload } = await jwtVerify(token, jwks, {
      issuer: 'https://appleid.apple.com',
      audience: audiences,
    });
    if (nonce && payload.nonce !== nonce) throw new Error('Apple authentication nonce is invalid.');
    return normalizeAppleIdentity(payload, user);
  },
};
