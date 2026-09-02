import type { AuthProviderAdapter } from '../types';
import { appleProvider } from './apple';
import { facebookProvider } from './facebook';
import { googleProvider } from './google';

export type SocialProvider = 'apple' | 'google' | 'facebook';
const providers: Record<SocialProvider, AuthProviderAdapter> = {
  apple: appleProvider,
  google: googleProvider,
  facebook: facebookProvider,
};
export function getAuthProvider(value: string) {
  const provider = providers[value as SocialProvider];
  if (!provider) throw new Error('Unsupported authentication provider.');
  return provider;
}
