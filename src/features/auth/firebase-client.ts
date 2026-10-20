'use client';
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onIdTokenChanged,
  type Auth,
} from 'firebase/auth';
import type { FirebaseAuthConfiguration } from '../../../packages/auth/firebase-contract';
let configured: Promise<FirebaseAuthConfiguration> | undefined;
let auth: Promise<Auth> | undefined;
let epoch = 0;
let exchangeQueue: Promise<unknown> = Promise.resolve();
let observing = false;
let lastExchanged = '';
export function firebaseClientConfiguration() {
  return (configured ??= fetch('/api/auth/config', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw Error('Authentication is unavailable.');
      return (await response.json()) as FirebaseAuthConfiguration;
    })
    .catch((error) => {
      configured = undefined;
      throw error;
    }));
}
export async function firebaseWebAuth() {
  return (auth ??= (async () => {
    const c = await firebaseClientConfiguration();
    if (c.mode !== 'firebase' || !c.firebase) throw Error('Firebase sign-in is not configured.');
    const app = getApps().find((a) => a.name === 'dd-auth') ?? initializeApp(c.firebase, 'dd-auth');
    return initializeAuth(app, { persistence: browserSessionPersistence });
  })().catch((error) => {
    auth = undefined;
    throw error;
  }));
}
async function exchange(idToken: string) {
  if (idToken === lastExchanged) return;
  const response = await fetch('/api/auth/firebase/session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) throw Error('Unable to establish your application session. Sign in again.');
  lastExchanged = idToken;
}
function queueExchange(idToken: string) {
  const generation = epoch;
  const task = exchangeQueue
    .catch(() => {})
    .then(async () => {
      if (generation === epoch) await exchange(idToken);
    });
  exchangeQueue = task;
  return task;
}
export async function firebaseWebSignIn(email: string, password: string, name?: string) {
  const a = await firebaseWebAuth();
  const result =
    name !== undefined
      ? await createUserWithEmailAndPassword(a, email.trim(), password)
      : await signInWithEmailAndPassword(a, email.trim(), password);
  if (name) await updateProfile(result.user, { displayName: name });
  await queueExchange(await result.user.getIdToken(true));
}
export async function firebaseWebReset(email: string) {
  await sendPasswordResetEmail(await firebaseWebAuth(), email.trim());
}
export async function firebaseWebDeletionToken() {
  if ((await firebaseClientConfiguration()).mode !== 'firebase') return undefined;
  const a = await firebaseWebAuth();
  await a.authStateReady();
  if (!a.currentUser) throw Error('Sign in again before deleting your account.');
  return a.currentUser.getIdToken(true);
}
export async function firebaseWebSignOut() {
  epoch++;
  lastExchanged = '';
  try {
    if ((await firebaseClientConfiguration()).mode === 'firebase')
      await signOut(await firebaseWebAuth());
  } finally {
    await exchangeQueue.catch(() => {});
    lastExchanged = '';
  }
  // The caller clears the HttpOnly cookie only after this queue has settled.
}
export async function startFirebaseWebSession() {
  if (observing || (await firebaseClientConfiguration()).mode !== 'firebase') return;
  const a = await firebaseWebAuth();
  if (observing) return;
  observing = true;
  const onChange = () => window.dispatchEvent(new Event('dd-firebase-session-refresh'));
  onIdTokenChanged(a, (user) => {
    if (user)
      void user
        .getIdToken()
        .then(queueExchange)
        .then(onChange)
        .catch(() => {
          // Never silently accept an SDK identity when the application rejected it.
          void firebaseWebSignOut()
            .catch(() => {})
            .then(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }))
            .catch(() => {})
            .finally(onChange);
        });
  });
}
