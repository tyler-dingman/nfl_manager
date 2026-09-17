import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { apiFetch } from './network';
import {
  currentUser,
  loginWithBrowser,
  exchangeNativeIdentity,
  loginWithEmail,
  logoutSession,
  type PublicUser,
} from './auth';

type AuthContextValue = {
  user: PublicUser | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  appleAvailable: boolean;
  googleAvailable: boolean;
  signInWithApple(): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
const googleSignIn = () =>
  require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const googleAvailable =
    Platform.OS === 'android' || (Platform.OS === 'ios' && Boolean(googleClientId));
  useEffect(() => {
    void currentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    if (Platform.OS === 'android')
      void apiFetch('/api/auth/config')
        .then(async (response) => (response.ok ? response.json() : null))
        .then((configuration) => setAppleAvailable(Boolean(configuration?.providers?.apple)))
        .catch(() => setAppleAvailable(false));
    if (Platform.OS === 'ios')
      void AppleAuthentication.isAvailableAsync()
        .then(setAppleAvailable)
        .catch(() => setAppleAvailable(false));
    if (googleClientId && Platform.OS === 'ios')
      googleSignIn().GoogleSignin.configure({
        webClientId: googleClientId,
        iosClientId: googleIosClientId,
      });
  }, [googleClientId, googleIosClientId]);
  const perform = async (action: () => Promise<PublicUser | null>) => {
    setBusy(true);
    setError(null);
    try {
      setUser(await action());
    } catch (caught) {
      const code =
        typeof caught === 'object' && caught && 'code' in caught ? String(caught.code) : '';
      if (code !== 'ERR_REQUEST_CANCELED')
        setError(caught instanceof Error ? caught.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      busy,
      error,
      appleAvailable,
      googleAvailable,
      refreshUser: async () => {
        setUser(await currentUser());
      },
      signInWithEmail: (email, password) => perform(() => loginWithEmail(email, password)),
      signInWithApple: () =>
        perform(async () => {
          if (Platform.OS === 'android') return (await loginWithBrowser('apple')) ?? user;
          const nonce =
            Crypto.randomUUID().replaceAll('-', '') + Crypto.randomUUID().replaceAll('-', '');
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
            nonce,
          });
          if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
          const name = credential.fullName;
          return exchangeNativeIdentity({
            provider: 'apple',
            identityToken: credential.identityToken,
            nonce,
            user: name
              ? JSON.stringify({ name: { firstName: name.givenName, lastName: name.familyName } })
              : undefined,
          });
        }),
      signInWithGoogle: () =>
        perform(async () => {
          if (Platform.OS === 'android') return (await loginWithBrowser('google')) ?? user;
          const { GoogleSignin, isSuccessResponse } = googleSignIn();
          const result = await GoogleSignin.signIn();
          if (!isSuccessResponse(result)) return user;
          if (!result.data.idToken) throw new Error('Google did not return an identity token.');
          return exchangeNativeIdentity({ provider: 'google', identityToken: result.data.idToken });
        }),
      logout: () =>
        perform(async () => {
          await logoutSession();
          if (googleAvailable && Platform.OS === 'ios')
            await googleSignIn()
              .GoogleSignin.signOut()
              .catch(() => undefined);
          return null;
        }),
    }),
    [appleAvailable, busy, error, googleAvailable, loading, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
