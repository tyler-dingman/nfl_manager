import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
const ACCESS = 'dd.mobile.access', REFRESH = 'dd.mobile.refresh', DEVICE = 'dd.mobile.device';
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export type MobileTokenPair = { accessToken: string; refreshToken: string };
export type PublicUser = { id: string; displayName: string; primaryEmail: string | null; avatarUrl: string | null };
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
    if (value === null) globalThis.localStorage?.removeItem(key); else globalThis.localStorage?.setItem(key, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
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
  await Promise.all([
    setItem(ACCESS, tokens.accessToken), setItem(REFRESH, tokens.refreshToken),
  ]);
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
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken, mobile: true }),
    });
    if (!response.ok) { await clearSession(); return null; }
    const body = (await response.json()) as MobileTokenPair;
    await saveSession(body);
    return body.accessToken;
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}
export async function authenticatedFetch(path: string, init: RequestInit = {}) {
  accessToken ??= await getItem(ACCESS);
  const send = (token: string | null) => fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...init.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  let response = await send(accessToken);
  if (response.status === 401) response = await send(await refreshAccessToken());
  return response;
}
export async function currentUser(): Promise<PublicUser | null> {
  try {
    const response = await authenticatedFetch('/api/auth/me');
    if (!response.ok) return null;
    return ((await response.json()) as { user: PublicUser }).user;
  } catch {
    return null;
  }
}
export async function exchangeNativeIdentity(input: NativeIdentityExchange) {
  const response = await fetch(`${API_BASE_URL}/api/auth/social/${input.provider}/exchange`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: input.identityToken, nonce: input.nonce, user: input.user,
      redirectUri: 'downdistance://auth', deviceId: await deviceId() }),
  });
  const body = (await response.json().catch(() => null)) as (({ ok: true; user: PublicUser } & MobileTokenPair) | { ok: false; error?: string } | null);
  if (!response.ok || !body?.ok) throw new Error(body && 'error' in body && body.error ? body.error : 'Sign-in failed.');
  await saveSession(body);
  return body.user;
}
export async function loginWithEmail(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password, mobile: true, deviceId: await deviceId() }),
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
    if (refreshToken) await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }),
    });
  } finally { await clearSession(); }
}
