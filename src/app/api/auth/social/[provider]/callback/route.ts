import { NextRequest, NextResponse } from 'next/server';
import { OAUTH_COOKIE, safeRedirect, setSessionCookie } from '@/server/auth/http';
import { authConfig } from '@/server/auth/config';
import { readOAuthState } from '@/server/auth/oauth-state';
import { getAuthProvider } from '@/server/auth/providers';
import { linkSocialIdentity, resolveSocialUser, toPublicUser } from '@/server/auth/repository';
import { requestMetadata } from '@/server/auth/request';
import { issueSession } from '@/server/auth/service';
import { createMobileHandoff, MOBILE_REDIRECT } from '@/server/auth/mobile-handoff';
import type { MobileOAuthState } from '@/server/auth/oauth-state';
async function callback(request: NextRequest, providerName: string, values: URLSearchParams) {
  let mobile: MobileOAuthState | undefined;
  try {
    const stateToken = request.cookies.get(OAUTH_COOKIE)?.value;
    if (!stateToken) throw new Error('Authentication state is missing.');
    const state = await readOAuthState(stateToken);
    if (state.provider !== providerName || state.state !== values.get('state'))
      throw new Error('Authentication state is invalid.');
    mobile = state.mobile;
    if (values.get('error')) throw new Error('Provider authorization was canceled or denied.');
    const provider = getAuthProvider(providerName);
    const redirectUri = `${authConfig.AUTH_BASE_URL ?? request.nextUrl.origin}/api/auth/social/${providerName}/callback`;
    const identity = await provider.validateCallback({
      code: values.get('code') ?? undefined,
      idToken: values.get('id_token') ?? undefined,
      accessToken: values.get('access_token') ?? undefined,
      user: values.get('user') ?? undefined,
      nonce: state.nonce,
      redirectUri,
    });
    const resolved = state.linkUserId
      ? await linkSocialIdentity(state.linkUserId, identity)
      : await resolveSocialUser(identity);
    if (!resolved) throw new Error('Unable to resolve account.');
    const user = toPublicUser(resolved);
    if (mobile) {
      const destination = new URL(MOBILE_REDIRECT);
      destination.searchParams.set('code', await createMobileHandoff(user.id, mobile.challenge));
      destination.searchParams.set('state', mobile.state);
      const response = NextResponse.redirect(destination, 303);
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('Referrer-Policy', 'no-referrer');
      response.cookies.delete(OAUTH_COOKIE);
      return response;
    }
    const session = await issueSession(user.id, requestMetadata(request));
    const destination = safeRedirect(state.next);
    const response = NextResponse.redirect(new URL(destination, request.url));
    setSessionCookie(response, session.refreshToken, session.expiresAt);
    response.cookies.delete(OAUTH_COOKIE);
    return response;
  } catch (error) {
    if (mobile) {
      const destination = new URL(MOBILE_REDIRECT);
      destination.searchParams.set('error', 'Sign-in could not be completed. Please try again.');
      destination.searchParams.set('state', mobile.state);
      const response = NextResponse.redirect(destination, 303);
      response.cookies.delete(OAUTH_COOKIE);
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }
    const response = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent((error as Error).message)}`, request.url),
    );
    response.cookies.delete(OAUTH_COOKIE);
    return response;
  }
}
export async function GET(request: NextRequest, { params }: { params: { provider: string } }) {
  return callback(request, params.provider, request.nextUrl.searchParams);
}
export async function POST(request: NextRequest, { params }: { params: { provider: string } }) {
  return callback(request, params.provider, new URLSearchParams(await request.text()));
}
