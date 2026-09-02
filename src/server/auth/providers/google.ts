import { createRemoteJWKSet, jwtVerify } from 'jose';
import { authConfig } from '../config';
import type { AuthProviderAdapter } from '../types';
import type { NormalizedIdentity } from '../types';

const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export function normalizeGoogleProfile(payload: Record<string, unknown>): NormalizedIdentity {
  if (typeof payload.sub !== 'string' || !payload.sub)
    throw new Error('Google identity subject is missing.');
  return {
    provider: 'GOOGLE',
    providerSubject: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    emailVerified: payload.email_verified === true,
    displayName: typeof payload.name === 'string' ? payload.name : null,
    firstName: typeof payload.given_name === 'string' ? payload.given_name : null,
    lastName: typeof payload.family_name === 'string' ? payload.family_name : null,
    avatarUrl: typeof payload.picture === 'string' ? payload.picture : null,
  };
}

export const googleProvider: AuthProviderAdapter = {
  beginAuthentication({ state, nonce, redirectUri }) {
    if (!authConfig.GOOGLE_CLIENT_ID) throw new Error('Google authentication is not configured.');
    const query = new URLSearchParams({
      client_id: authConfig.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
  },
  async validateCallback({ code, idToken, nonce, redirectUri, codeVerifier }) {
    const audiences = [authConfig.GOOGLE_CLIENT_ID, authConfig.GOOGLE_IOS_CLIENT_ID].filter(
      (value): value is string => Boolean(value),
    );
    if (!audiences.length)
      throw new Error('Google authentication is not configured.');
    let token = idToken;
    if (!token && code) {
      if (!authConfig.GOOGLE_CLIENT_ID || !authConfig.GOOGLE_CLIENT_SECRET)
        throw new Error('Google web authentication is not configured.');
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
          client_id: authConfig.GOOGLE_CLIENT_ID,
          client_secret: authConfig.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      if (!response.ok) throw new Error('Google token exchange failed.');
      token = ((await response.json()) as { id_token?: string }).id_token;
    }
    if (!token) throw new Error('Google identity token is missing.');
    const { payload } = await jwtVerify(token, jwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: audiences,
    });
    if (nonce && payload.nonce !== nonce)
      throw new Error('Google authentication nonce is invalid.');
    return normalizeGoogleProfile(payload);
  },
};
