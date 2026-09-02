import { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE = 'dd_session';
export const OAUTH_COOKIE = 'dd_oauth';

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  if (
    process.env.NODE_ENV === 'development' &&
    /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/.test(origin)
  )
    return;
  if (new URL(origin).origin !== request.nextUrl.origin) throw new Error('Invalid request origin.');
}

export function safeRedirect(value: string | null | undefined, fallback = '/') {
  return value?.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function authError(message = 'Unable to authenticate.', status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
