import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL, apiFetch } from './network';
const ACCESS = 'dd.mobile.access',
  REFRESH = 'dd.mobile.refresh',
  DEVICE = 'dd.mobile.device';
export type MobileTokenPair = { accessToken: string; refreshToken: string };
export type PublicUser = {
  id: string;
  displayName: string;
  primaryEmail: string | null;
  avatarUrl: string | null;
};
export interface NativeIdentityExchange {
  provider: 'apple' | 'google' | 'facebook';
  identityToken: string;
  nonce?: string;
  user?: string;
}
let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
async function getItem(key: string) {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}
async function setItem(key: string, value: string | null) {
  if (Platform.OS === 'web') {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
}
async function deviceId() {
  const existing = await getItem(DEVICE);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await setItem(DEVICE, created);
  return created;
}
export async function saveSession(tokens: MobileTokenPair) {
  accessToken = tokens.accessToken;
  await Promise.all([setItem(ACCESS, tokens.accessToken), setItem(REFRESH, tokens.refreshToken)]);
}
export async function clearSession() {
  accessToken = null;
  await Promise.all([setItem(ACCESS, null), setItem(REFRESH, null)]);
}
async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = await getItem(REFRESH);
    if (!refreshToken) return null;
    const response = await apiFetch('/api/auth/refresh', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken, mobile: true }),
    });
    if (!response.ok) {
      await clearSession();
      return null;
    }
    const body = (await response.json()) as MobileTokenPair;
    await saveSession(body);
    return body.accessToken;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}
export async function authenticatedFetch(path: string, init: RequestInit = {}) {
  accessToken ??= await getItem(ACCESS);
  const send = (token: string | null) =>
    apiFetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  let response = await send(accessToken);
  if (response.status === 401) response = await send(await refreshAccessToken());
  return response;
}
export async function currentUser(): Promise<PublicUser | null> {
  try {
    if (!(await getItem(ACCESS)) && !(await getItem(REFRESH))) return null;
    const response = await authenticatedFetch('/api/auth/me');
    if (!response.ok) return null;
    return ((await response.json()) as { user: PublicUser }).user;
  } catch {
    return null;
  }
}
export async function exchangeNativeIdentity(input: NativeIdentityExchange) {
  const response = await apiFetch(`/api/auth/social/${input.provider}/exchange`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idToken: input.identityToken,
      nonce: input.nonce,
      user: input.user,
      redirectUri: 'downdistance://auth',
      deviceId: await deviceId(),
    }),
  });
  const body = (await response.json().catch(() => null)) as
    | ({ ok: true; user: PublicUser } & MobileTokenPair)
    | { ok: false; error?: string }
    | null;
  if (!response.ok || !body?.ok)
    throw new Error(body && 'error' in body && body.error ? body.error : 'Sign-in failed.');
  await saveSession(body);
  return body.user;
}
export async function loginWithEmail(email: string, password: string) {
  const response = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim(),
      password,
      mobile: true,
      deviceId: await deviceId(),
    }),
  });
  const body = (await response.json().catch(() => null)) as
    | ({ ok: true; user: PublicUser } & MobileTokenPair)
    | { ok: false; error?: string }
    | null;
  if (!response.ok || !body?.ok)
    throw new Error(body && 'error' in body && body.error ? body.error : 'Sign-in failed.');
  await saveSession(body);
  return body.user;
}
export async function logoutSession() {
  const refreshToken = await getItem(REFRESH);
  try {
    if (refreshToken)
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
  } finally {
    await clearSession();
  }
}

export async function loginWithBrowser(provider: 'apple' | 'google'): Promise<PublicUser | null> {
  const configuration = await apiFetch('/api/auth/config');
  const available = await configuration.json().catch(() => null);
  if (!configuration.ok || !available?.ok)
    throw new Error('Sign-in is temporarily unavailable. Please try again later.');
  if (!available.providers?.[provider])
    throw new Error(
      `${provider === 'apple' ? 'Apple' : 'Google'} sign-in is not yet available. Please use another sign-in option.`,
    );
  const verifier =
    Crypto.randomUUID().replaceAll('-', '') + Crypto.randomUUID().replaceAll('-', '');
  const challenge = (
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    })
  )
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  const state = Crypto.randomUUID().replaceAll('-', '');
  const redirect = 'downdistance://sign-in';
  const url = new URL(`${API_BASE_URL}/api/auth/social/${provider}/start`);
  url.searchParams.set('mobile', '1');
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('mobile_state', state);
  const result = await WebBrowser.openAuthSessionAsync(url.toString(), redirect);
  if (result.type !== 'success') return null;
  const callback = new URL(result.url);
  if (
    `${callback.protocol}//${callback.host}${callback.pathname}` !== redirect ||
    callback.searchParams.get('state') !== state
  )
    throw new Error('Sign-in response was invalid. Please try again.');
  if (callback.searchParams.has('error'))
    throw new Error('Sign-in could not be completed. Please try again.');
  const code = callback.searchParams.get('code');
  if (!code) throw new Error('Sign-in did not return a code.');
  const response = await apiFetch('/api/auth/mobile/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier: verifier, deviceId: await deviceId() }),
  });
  const body = await response.json();
  if (!response.ok || !body?.ok) throw new Error(body?.error ?? 'Sign-in failed.');
  await saveSession(body);
  return body.user;
}
