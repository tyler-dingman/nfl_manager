import { initializeApp, getApps } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import type { Auth, Persistence } from 'firebase/auth';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiFetch } from './network';
import type { FirebaseAuthConfiguration } from '../../../packages/auth/firebase-contract';
let configuration: Promise<FirebaseAuthConfiguration> | undefined;
let initialized: Promise<Auth> | undefined;
export function mobileFirebaseConfiguration() {
  return (configuration ??= apiFetch('/api/auth/config')
    .then(async (response) => {
      if (!response.ok) throw Error('Authentication is unavailable.');
      return (await response.json()) as FirebaseAuthConfiguration;
    })
    .catch((error) => {
      configuration = undefined;
      throw error;
    }));
}
// SecureStore key length/character restrictions and historic 2KB value limit require chunking.
// A random generation makes the manifest switch atomic; stale chunks are removed after success.
const keyFor = (key: string) =>
  'dd.firebase.' +
  Array.from(key)
    .map((c) => c.charCodeAt(0).toString(16))
    .join('');
const securePersistence = {
  async getItem(key: string) {
    const prefix = keyFor(key),
      raw = await SecureStore.getItemAsync(prefix);
    if (!raw) return null;
    const manifest = JSON.parse(raw) as { generation: string; count: number };
    if (!Number.isInteger(manifest.count) || manifest.count < 1 || manifest.count > 64)
      throw Error('Invalid auth persistence.');
    const values = await Promise.all(
      Array.from({ length: manifest.count }, (_, i) =>
        SecureStore.getItemAsync(`${prefix}.${manifest.generation}.${i}`),
      ),
    );
    if (values.some((value) => value === null)) throw Error('Incomplete auth persistence.');
    return values.join('');
  },
  async setItem(key: string, value: string) {
    const prefix = keyFor(key),
      old = await SecureStore.getItemAsync(prefix);
    const generation = Date.now().toString(36) + Math.random().toString(36).slice(2),
      count = Math.ceil(value.length / 500);
    if (count < 1 || count > 64) throw Error('Auth persistence exceeds storage budget.');
    for (let i = 0; i < count; i++)
      await SecureStore.setItemAsync(
        `${prefix}.${generation}.${i}`,
        value.slice(i * 1000, (i + 1) * 1000),
        { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
      );
    await SecureStore.setItemAsync(prefix, JSON.stringify({ generation, count }), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (old) {
      const previous = JSON.parse(old);
      for (let i = 0; i < previous.count; i++)
        await SecureStore.deleteItemAsync(`${prefix}.${previous.generation}.${i}`);
    }
  },
  async removeItem(key: string) {
    const prefix = keyFor(key),
      old = await SecureStore.getItemAsync(prefix);
    await SecureStore.deleteItemAsync(prefix);
    if (old) {
      const previous = JSON.parse(old);
      for (let i = 0; i < previous.count; i++)
        await SecureStore.deleteItemAsync(`${prefix}.${previous.generation}.${i}`);
    }
  },
};
export function mobileFirebaseAuth() {
  return (initialized ??= (async () => {
    const c = await mobileFirebaseConfiguration();
    if (c.mode !== 'firebase' || !c.firebase) throw Error('Firebase sign-in is not configured.');
    const app =
      getApps().find((a) => a.name === 'dd-mobile-auth') ??
      initializeApp(c.firebase, 'dd-mobile-auth');
    const native = FirebaseAuth as typeof FirebaseAuth & {
      getReactNativePersistence(storage: typeof securePersistence): Persistence;
    };
    const auth = FirebaseAuth.initializeAuth(app, {
      persistence:
        Platform.OS === 'web'
          ? FirebaseAuth.browserSessionPersistence
          : native.getReactNativePersistence(securePersistence),
    });
    await auth.authStateReady();
    return auth;
  })().catch((error) => {
    initialized = undefined;
    throw error;
  }));
}
export async function mobileFirebaseReset(email: string) {
  await FirebaseAuth.sendPasswordResetEmail(await mobileFirebaseAuth(), email.trim());
}
export async function mobileFirebaseRegister(email: string, password: string, displayName: string) {
  const credential = await FirebaseAuth.createUserWithEmailAndPassword(
    await mobileFirebaseAuth(),
    email.trim(),
    password,
  );
  if (displayName) await FirebaseAuth.updateProfile(credential.user, { displayName });
}
export async function mobileFirebaseDeletionToken() {
  if ((await mobileFirebaseConfiguration()).mode !== 'firebase') return undefined;
  const user = (await mobileFirebaseAuth()).currentUser;
  if (!user) throw Error('Sign in again before deleting your account.');
  return user.getIdToken(true);
}
