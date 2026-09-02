'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, LockKeyhole } from 'lucide-react';
import AuthProviderIcon from '@/components/auth/auth-provider-icon';
import { FiveWideLogo } from '@/components/branding/fivewide-logo';
import TeamThemeProvider from '@/components/team-theme-provider';
import { notifyAuthChanged } from '@/features/auth/auth-session';

type Mode = 'options' | 'email-login' | 'email-signup' | 'forgot';
type Config = { email: boolean; providers: { apple: boolean; google: boolean; facebook: boolean } };
const inputClass =
  'mt-2 h-14 w-full rounded-2xl border border-[#00172B]/15 px-4 text-base font-semibold normal-case tracking-normal outline-none focus:border-[#FF3D38]';
const providerClass =
  'flex h-14 w-full items-center justify-center gap-3 rounded-full border border-[#00172B]/15 bg-white px-5 font-black text-[#00172B] transition hover:border-[#FF3D38] disabled:cursor-not-allowed disabled:opacity-40';

export default function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('options');
  const [config, setConfig] = useState<Config | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(searchParams?.get('error') ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const requested = searchParams?.get('next');
  const next = requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/';

  useEffect(() => {
    void fetch('/api/auth/config')
      .then((response) => response.json())
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);
  const social = (provider: keyof Config['providers']) =>
    window.location.assign(`/api/auth/social/${provider}/start?next=${encodeURIComponent(next)}`);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const body = (await response.json()) as { message?: string };
        setMessage(body.message ?? 'If an account exists, a reset link will be sent.');
        return;
      }
      if (mode === 'email-signup' && password !== confirmPassword)
        throw new Error('Passwords do not match.');
      const response = await fetch(
        mode === 'email-signup' ? '/api/auth/signup' : '/api/auth/login',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password, displayName: name || undefined }),
        },
      );
      const body = (await response.json()) as {
        error?: string;
        onboarding?: { completed: boolean };
      };
      if (!response.ok) throw new Error(body.error ?? 'Unable to authenticate.');
      notifyAuthChanged();
      router.push(next === '/' && !body.onboarding?.completed ? '/onboarding' : next);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to authenticate.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <TeamThemeProvider>
      <main className="grid min-h-screen bg-[#f7f4ee] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#00172B] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -bottom-48 -left-36 h-[34rem] w-[34rem] rounded-full bg-[#FF3D38]" />
          <FiveWideLogo
            size={120}
            generic
            containerClassName="relative h-auto w-52 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none ring-0"
            priority
          />
          <div className="relative max-w-xl">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#F4D9B7]">
              One account. Every screen.
            </p>
            <h1 className="mt-5 text-6xl font-black uppercase leading-[0.88] tracking-[-0.055em]">
              Pick up exactly where you left off.
            </h1>
            <ul className="mt-8 space-y-3 text-sm font-bold text-white/65">
              {['Your team and preferences', 'Front Office progress', 'Web, iOS, and Android'].map(
                (item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Check className="h-4 w-4 text-[#F4D9B7]" /> {item}
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>
        <section className="flex items-center justify-center px-4 py-12 sm:px-8">
          <div className="w-full max-w-md">
            <Link
              href="/"
              className="inline-flex text-sm font-black text-[#00172B]/50 hover:text-[#00172B]"
            >
              ← Back to Down &amp; Distance
            </Link>
            <div className="mt-8 rounded-[2rem] bg-white p-6 shadow-[0_24px_70px_rgba(0,23,43,0.12)] sm:p-9">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF3D38]">
                Down &amp; Distance account
              </p>
              <h2 className="mt-3 text-4xl font-black uppercase tracking-[-0.045em] text-[#00172B]">
                {mode === 'email-signup'
                  ? 'Create account.'
                  : mode === 'forgot'
                    ? 'Reset access.'
                    : 'Welcome back.'}
              </h2>
              {mode === 'options' ? (
                <div className="mt-7 space-y-3">
                  <button
                    disabled={!config?.providers.apple}
                    onClick={() => social('apple')}
                    className={providerClass}
                  >
                    <AuthProviderIcon provider="APPLE" className="h-6 w-6" /> Continue with Apple
                  </button>
                  <button
                    disabled={!config?.providers.google}
                    onClick={() => social('google')}
                    className={providerClass}
                  >
                    <AuthProviderIcon provider="GOOGLE" className="h-6 w-6" /> Continue with Google
                  </button>
                  <button
                    disabled={!config?.providers.facebook}
                    onClick={() => social('facebook')}
                    className={providerClass}
                  >
                    <AuthProviderIcon provider="FACEBOOK" className="h-6 w-6" /> Continue with Facebook
                  </button>
                  <div className="flex items-center gap-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#00172B]/35">
                    <span className="h-px flex-1 bg-[#00172B]/10" /> Or{' '}
                    <span className="h-px flex-1 bg-[#00172B]/10" />
                  </div>
                  <button
                    disabled={!config?.email}
                    onClick={() => setMode('email-login')}
                    className="flex h-14 w-full items-center justify-center rounded-full bg-[#00172B] font-black text-white hover:bg-[#FF3D38] disabled:opacity-40"
                  >
                    <AuthProviderIcon provider="EMAIL" className="mr-3 h-5 w-5" /> Continue with email
                  </button>
                  {config && !config.email ? (
                    <p className="text-center text-xs font-semibold text-amber-700">
                      Complete the authentication environment setup and database migration to enable
                      sign-in.
                    </p>
                  ) : null}
                </div>
              ) : (
                <form onSubmit={submit} className="mt-7 space-y-4">
                  {mode === 'email-signup' ? (
                    <label className="block text-xs font-black uppercase tracking-[0.16em] text-[#00172B]/55">
                      Name <span className="normal-case tracking-normal">(optional)</span>
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        autoComplete="name"
                        className={inputClass}
                      />
                    </label>
                  ) : null}
                  <label className="block text-xs font-black uppercase tracking-[0.16em] text-[#00172B]/55">
                    Email
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      className={inputClass}
                    />
                  </label>
                  {mode !== 'forgot' ? (
                    <label className="block text-xs font-black uppercase tracking-[0.16em] text-[#00172B]/55">
                      Password
                      <input
                        required
                        minLength={10}
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete={mode === 'email-login' ? 'current-password' : 'new-password'}
                        className={inputClass}
                      />
                    </label>
                  ) : null}
                  {mode === 'email-signup' ? (
                    <label className="block text-xs font-black uppercase tracking-[0.16em] text-[#00172B]/55">
                      Confirm password
                      <input
                        required
                        minLength={10}
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                        className={inputClass}
                      />
                    </label>
                  ) : null}
                  {error ? (
                    <p
                      role="alert"
                      className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700"
                    >
                      {error}
                    </p>
                  ) : null}
                  {message ? (
                    <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                      {message}
                    </p>
                  ) : null}
                  <button
                    disabled={busy}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#00172B] font-black text-white transition hover:bg-[#FF3D38] disabled:opacity-60"
                  >
                    {busy
                      ? 'Working…'
                      : mode === 'email-signup'
                        ? 'Create account'
                        : mode === 'forgot'
                          ? 'Send reset link'
                          : 'Sign in'}{' '}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <div className="flex justify-between text-sm font-black text-[#FF3D38]">
                    <button type="button" onClick={() => setMode('options')}>
                      All sign-in options
                    </button>
                    {mode === 'email-login' ? (
                      <button type="button" onClick={() => setMode('forgot')}>
                        Forgot password?
                      </button>
                    ) : null}
                  </div>
                  {mode !== 'forgot' ? (
                    <button
                      type="button"
                      onClick={() =>
                        setMode(mode === 'email-signup' ? 'email-login' : 'email-signup')
                      }
                      className="w-full text-sm font-black text-[#00172B]"
                    >
                      {mode === 'email-signup'
                        ? 'Already have an account? Sign in'
                        : 'New here? Create an account'}
                    </button>
                  ) : null}
                </form>
              )}
              <p className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-[#00172B]/35">
                <LockKeyhole className="h-3.5 w-3.5" /> Secure Down &amp; Distance session
              </p>
            </div>
          </div>
        </section>
      </main>
    </TeamThemeProvider>
  );
}
