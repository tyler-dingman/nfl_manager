import { applicationBackend, applicationEnvironment } from '../persistence/bindings';
import type { FirebaseClientConfiguration } from '../../../packages/auth/firebase-contract';
// Legacy authentication requires an explicit offline/rollback opt-in; missing configuration fails closed.
export const firebaseSelected = () => {
  const env = applicationEnvironment();
  return env.AUTH_PROVIDER !== 'legacy' || env.APP_LEGACY_AUTH_ENABLED !== 'true';
};
export function firebaseConfiguration(): FirebaseClientConfiguration {
  const e = applicationEnvironment();
  if (!firebaseSelected() || e.FIREBASE_AUTH_ENABLED !== 'true' || applicationBackend() !== 'd1')
    throw Error('Firebase authentication is not configured.');
  const {
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_API_KEY: apiKey,
    FIREBASE_AUTH_DOMAIN: authDomain,
    FIREBASE_APP_ID: appId,
  } = e;
  if (
    !projectId ||
    !/^[a-z][a-z0-9-]{4,62}$/.test(projectId) ||
    !apiKey ||
    !appId ||
    authDomain !== `${projectId}.firebaseapp.com`
  )
    throw Error('Firebase authentication configuration is incomplete.');
  return { projectId, apiKey, authDomain, appId };
}
export function publicFirebaseConfiguration() {
  try {
    return firebaseConfiguration();
  } catch {
    return null;
  }
}
