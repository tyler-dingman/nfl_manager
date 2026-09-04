import { NextRequest, NextResponse } from 'next/server';
import { OAUTH_COOKIE, safeRedirect, setSessionCookie } from '@/server/auth/http';
import { authConfig } from '@/server/auth/config';
import { readOAuthState } from '@/server/auth/oauth-state';
import { getAuthProvider } from '@/server/auth/providers';
import { linkSocialIdentity, resolveSocialUser, toPublicUser } from '@/server/auth/repository';
import { requestMetadata } from '@/server/auth/request';
import { issueSession } from '@/server/auth/service';
import { getOnboarding } from '@/server/user/repository';
async function callback(request: NextRequest, providerName: string, values: URLSearchParams) {
  try {
    if (values.get('error')) throw new Error('Provider authorization was canceled or denied.');
    const stateToken = request.cookies.get(OAUTH_COOKIE)?.value;
    if (!stateToken) throw new Error('Authentication state is missing.');
    const state = await readOAuthState(stateToken);
    if (state.provider !== providerName || state.state !== values.get('state'))
      throw new Error('Authentication state is invalid.');
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
    const session = await issueSession(user.id, requestMetadata(request));
    const onboarding = await getOnboarding(user.id);
    const destination =
      safeRedirect(state.next) === '/' && !onboarding.completed
        ? '/onboarding'
        : safeRedirect(state.next);
    const response = NextResponse.redirect(new URL(destination, request.url));
    setSessionCookie(response, session.refreshToken, session.expiresAt);
    response.cookies.delete(OAUTH_COOKIE);
    return response;
  } catch (error) {
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
