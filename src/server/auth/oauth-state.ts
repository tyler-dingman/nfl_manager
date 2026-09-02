import { jwtVerify, SignJWT } from 'jose';
import { requireAuthConfig } from './config';
import { secureToken } from './crypto';

const key = () => new TextEncoder().encode(requireAuthConfig().AUTH_JWT_SECRET);
export async function createOAuthState(provider: string, next: string, linkUserId?: string) {
  const state = secureToken();
  const nonce = secureToken();
  const token = await new SignJWT({ provider, state, nonce, next, linkUserId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('down-distance')
    .setAudience('down-distance-oauth')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(key());
  return { state, nonce, token };
}
export async function readOAuthState(token: string) {
  const { payload } = await jwtVerify(token, key(), {
    issuer: 'down-distance',
    audience: 'down-distance-oauth',
  });
  return {
    provider: String(payload.provider),
    state: String(payload.state),
    nonce: String(payload.nonce),
    next: String(payload.next ?? '/'),
    linkUserId: typeof payload.linkUserId === 'string' ? payload.linkUserId : undefined,
  };
}
