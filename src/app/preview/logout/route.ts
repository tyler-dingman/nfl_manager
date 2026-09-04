import { NextRequest, NextResponse } from 'next/server';
import { PREVIEW_COOKIE } from '@/lib/prelaunch';

export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/preview', request.url));
  response.cookies.set(PREVIEW_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
