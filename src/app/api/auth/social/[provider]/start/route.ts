import { NextRequest, NextResponse } from 'next/server';
import { OAUTH_COOKIE, safeRedirect } from '@/server/auth/http';
import { createOAuthState } from '@/server/auth/oauth-state';
import { authConfig } from '@/server/auth/config';
import { getAuthProvider } from '@/server/auth/providers';
import { currentUser } from '@/server/auth/request';
export async function GET(request: NextRequest, { params }: { params: { provider: string } }) {
  try {
    const provider = getAuthProvider(params.provider);
    const next = safeRedirect(request.nextUrl.searchParams.get('next'));
    const link = request.nextUrl.searchParams.get('link') === '1';
    const user = link ? await currentUser(request) : null;
    if (link && !user) throw new Error('Sign in before linking another account.');
    const state = await createOAuthState(params.provider, next, user?.id);
    const redirectUri = `${authConfig.AUTH_BASE_URL ?? request.nextUrl.origin}/api/auth/social/${params.provider}/callback`;
    const response = NextResponse.redirect(provider.beginAuthentication({ ...state, redirectUri }));
    response.cookies.set(OAUTH_COOKIE, state.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite:
        params.provider === 'apple' && process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 600,
    });
    return response;
  } catch (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent((error as Error).message)}`, request.url),
    );
  }
}
