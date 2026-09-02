export const AUTH_PROVIDERS = ['APPLE', 'GOOGLE', 'FACEBOOK', 'EMAIL'] as const;
export type AuthProviderName = (typeof AUTH_PROVIDERS)[number];

export type PublicUser = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  primaryEmail: string | null;
  emailVerified: boolean;
  avatarUrl: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED' | 'PENDING';
  createdAt: string;
  lastLoginAt: string | null;
};

export type NormalizedIdentity = {
  provider: Exclude<AuthProviderName, 'EMAIL'>;
  providerSubject: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
};

export interface AuthProviderAdapter {
  beginAuthentication(input: { state: string; nonce: string; redirectUri: string }): string;
  validateCallback(input: {
    code?: string;
    idToken?: string;
    accessToken?: string;
    nonce?: string;
    codeVerifier?: string;
    redirectUri: string;
    user?: string;
  }): Promise<NormalizedIdentity>;
}
