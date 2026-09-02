import { NextRequest } from 'next/server';
import { SESSION_COOKIE } from './http';
import { userFromAccessToken, userFromSessionToken } from './service';

export const requestMetadata = (request: NextRequest) => ({
  ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  userAgent: request.headers.get('user-agent'),
});

export async function currentUser(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    return userFromAccessToken(authorization.slice(7).trim());
  }
  return userFromSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}
