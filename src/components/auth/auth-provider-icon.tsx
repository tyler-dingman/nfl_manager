import { Mail } from 'lucide-react';

type AuthProvider = 'APPLE' | 'GOOGLE' | 'FACEBOOK' | 'EMAIL';

export const providerDisplayName = (provider: string) =>
  provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase();

export default function AuthProviderIcon({
  provider,
  className = 'h-5 w-5',
}: {
  provider: AuthProvider | string;
  className?: string;
}) {
  const normalized = provider.toUpperCase();

  if (normalized === 'GOOGLE') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z" />
        <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.38l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.53l3.35-2.61Z" />
        <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z" />
      </svg>
    );
  }

  if (normalized === 'FACEBOOK') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#1877F2" />
        <path fill="#fff" d="M13.55 21v-8h2.68l.4-3.12h-3.08v-2c0-.9.25-1.52 1.55-1.52h1.65V3.58a22 22 0 0 0-2.41-.13c-2.39 0-4.02 1.46-4.02 4.14v2.29h-2.7V13h2.7v8h3.23Z" />
      </svg>
    );
  }

  if (normalized === 'APPLE') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M17.05 12.54c-.03-3.01 2.46-4.47 2.57-4.54a5.5 5.5 0 0 0-4.34-2.35c-1.83-.19-3.61 1.1-4.54 1.1-.95 0-2.39-1.08-3.94-1.05a5.74 5.74 0 0 0-4.83 2.94c-2.11 3.65-.54 9.01 1.48 11.96 1.01 1.45 2.18 3.07 3.73 3.01 1.51-.06 2.08-.97 3.91-.97 1.81 0 2.35.97 3.93.93 1.63-.03 2.66-1.45 3.63-2.92a12 12 0 0 0 1.66-3.38 5.21 5.21 0 0 1-3.26-4.73ZM14.08 3.71A5.3 5.3 0 0 0 15.29 0a5.4 5.4 0 0 0-3.49 1.77 5.04 5.04 0 0 0-1.24 3.57 4.46 4.46 0 0 0 3.52-1.63Z" />
      </svg>
    );
  }

  return <Mail className={className} aria-hidden="true" />;
}
