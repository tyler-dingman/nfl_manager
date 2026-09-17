import { createHash } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { requireAuthConfig } from './config';
import { secureToken } from './crypto';
import { createOneTimeToken, consumeOneTimeToken } from './repository';

const key = () => new TextEncoder().encode(requireAuthConfig().AUTH_JWT_SECRET);
export const MOBILE_REDIRECT = 'downdistance://sign-in';
export function validMobileChallenge(value: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}
export function matchesMobileVerifier(challenge: string, verifier: string) {
  return (
    /^[A-Za-z0-9._~-]{43,128}$/.test(verifier) &&
    createHash('sha256').update(verifier).digest('base64url') === challenge
  );
}
export async function createMobileHandoff(userId: string, challenge: string) {
  if (!validMobileChallenge(challenge)) throw new Error('Invalid mobile challenge.');
  const id = secureToken();
  await createOneTimeToken(userId, 'OAUTH_STATE', id, 2);
  return new SignJWT({ challenge })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setJti(id)
    .setIssuer('down-distance')
    .setAudience('down-distance-mobile-handoff')
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(key());
}
export async function consumeMobileHandoff(code: string, verifier: string) {
  const { payload } = await jwtVerify(code, key(), {
    algorithms: ['HS256'],
    issuer: 'down-distance',
    audience: 'down-distance-mobile-handoff',
  });
  if (
    !payload.jti ||
    !payload.sub ||
    typeof payload.challenge !== 'string' ||
    !matchesMobileVerifier(payload.challenge, verifier)
  )
    throw new Error('Invalid mobile sign-in.');
  const consumed = await consumeOneTimeToken(payload.jti, 'OAUTH_STATE');
  if (!consumed || consumed.user_id !== payload.sub)
    throw new Error('Mobile sign-in expired or already used.');
  return consumed.user_id;
}
