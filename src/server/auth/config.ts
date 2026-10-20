import { firebaseSelected, publicFirebaseConfiguration } from './firebase-config';
import { z } from 'zod';
import {
  applicationBackend,
  applicationEnvironment,
  passwordRuntimeAvailable,
} from '../persistence/bindings';
import { assertAuthSecret } from './secret-policy';

const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional(),
);
const schema = z.object({
  DATABASE_URL: optionalString,
  AUTH_BASE_URL: optionalUrl,
  AUTH_JWT_SECRET: optionalString,
  APPLE_CLIENT_ID: optionalString,
  APPLE_IOS_CLIENT_ID: optionalString,
  APPLE_TEAM_ID: optionalString,
  APPLE_KEY_ID: optionalString,
  APPLE_PRIVATE_KEY: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_IOS_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  FACEBOOK_APP_ID: optionalString,
  FACEBOOK_APP_SECRET: optionalString,
});

// Resolve request-scoped Worker secrets at access time; never capture one user's
// bindings in module-global configuration shared with subsequent requests.
export const authConfig: z.infer<typeof schema> = new Proxy({} as z.infer<typeof schema>, {
  get: (_target, property) => Reflect.get(schema.parse(applicationEnvironment()), property),
  ownKeys: () => Reflect.ownKeys(schema.parse(applicationEnvironment())),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});
export const isAuthDatabaseConfigured =
  Boolean(authConfig.DATABASE_URL) || applicationBackend() === 'd1';

export function configuredSocialProviders(config: typeof authConfig = authConfig) {
  return {
    apple: Boolean(
      config.APPLE_CLIENT_ID &&
      config.APPLE_TEAM_ID &&
      config.APPLE_KEY_ID &&
      config.APPLE_PRIVATE_KEY,
    ),
    google: Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET),
    facebook: Boolean(config.FACEBOOK_APP_ID && config.FACEBOOK_APP_SECRET),
  };
}

export function validateProductionAuthConfig() {
  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PHASE === 'phase-production-build')
    return;
  requireAuthConfig();
  const providers = [
    [
      'APPLE',
      [
        authConfig.APPLE_CLIENT_ID,
        authConfig.APPLE_TEAM_ID,
        authConfig.APPLE_KEY_ID,
        authConfig.APPLE_PRIVATE_KEY,
      ],
    ],
    ['GOOGLE', [authConfig.GOOGLE_CLIENT_ID, authConfig.GOOGLE_CLIENT_SECRET]],
    ['FACEBOOK', [authConfig.FACEBOOK_APP_ID, authConfig.FACEBOOK_APP_SECRET]],
  ] as const;
  for (const [name, values] of providers) {
    if (values.some(Boolean) && values.some((value) => !value))
      throw new Error(`${name} authentication configuration is incomplete.`);
  }
}

export function requireAuthConfig() {
  if (!authConfig.DATABASE_URL && applicationBackend() !== 'd1')
    throw new Error('Authentication database is not configured.');
  assertAuthSecret(authConfig.AUTH_JWT_SECRET);
  return authConfig as typeof authConfig & { DATABASE_URL: string; AUTH_JWT_SECRET: string };
}

export function publicAuthConfig() {
  const selected = firebaseSelected();
  const firebase = publicFirebaseConfiguration();
  return {
    mode: selected ? 'firebase' : 'legacy',
    firebase,
    database: Boolean(authConfig.DATABASE_URL) || applicationBackend() === 'd1',
    email: selected
      ? Boolean(firebase)
      : Boolean(
          (authConfig.DATABASE_URL || applicationBackend() === 'd1') &&
          authConfig.AUTH_JWT_SECRET &&
          passwordRuntimeAvailable(),
        ),
    providers: selected
      ? { apple: false, google: false, facebook: false }
      : configuredSocialProviders(),
  };
}

validateProductionAuthConfig();
