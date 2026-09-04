import { authConfig } from '../config';
import type { AuthProviderAdapter } from '../types';
import type { NormalizedIdentity } from '../types';

type FacebookProfile = {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  picture?: { data?: { url?: string } };
};

export function normalizeFacebookProfile(
  profile: FacebookProfile,
  validatedUserId: string,
): NormalizedIdentity {
  if (!profile.id || profile.id !== validatedUserId)
    throw new Error('Facebook profile does not match the validated access token.');
  return {
    provider: 'FACEBOOK',
    providerSubject: profile.id,
    email: profile.email ?? null,
    // Facebook's basic profile response does not provide a separate verified-email claim.
    emailVerified: false,
    displayName: profile.name ?? null,
    firstName: profile.first_name ?? null,
    lastName: profile.last_name ?? null,
    avatarUrl: profile.picture?.data?.url ?? null,
  };
}

export const facebookProvider: AuthProviderAdapter = {
  beginAuthentication({ state, redirectUri }) {
    if (!authConfig.FACEBOOK_APP_ID) throw new Error('Facebook authentication is not configured.');
    const query = new URLSearchParams({
      client_id: authConfig.FACEBOOK_APP_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'email,public_profile',
      state,
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${query}`;
  },
  async validateCallback({ code, accessToken, redirectUri }) {
    const { FACEBOOK_APP_ID, FACEBOOK_APP_SECRET } = authConfig;
    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET)
      throw new Error('Facebook authentication is not configured.');
    let token = accessToken;
    if (!token && code) {
      const query = new URLSearchParams({
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      });
      const response = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${query}`);
      if (!response.ok) throw new Error('Facebook token exchange failed.');
      token = ((await response.json()) as { access_token?: string }).access_token;
    }
    if (!token) throw new Error('Facebook access token is missing.');
    const appToken = `${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`;
    const debug = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken)}`,
    );
    const debugData = (await debug.json()) as {
      data?: { is_valid?: boolean; app_id?: string; user_id?: string };
    };
    if (
      !debugData.data?.is_valid ||
      debugData.data.app_id !== FACEBOOK_APP_ID ||
      !debugData.data.user_id
    )
      throw new Error('Facebook access token is invalid.');
    const profileResponse = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name,first_name,last_name,email,picture&access_token=${encodeURIComponent(token)}`,
    );
    if (!profileResponse.ok) throw new Error('Facebook profile request failed.');
    const profile = (await profileResponse.json()) as FacebookProfile;
    return normalizeFacebookProfile(profile, debugData.data.user_id);
  },
};
