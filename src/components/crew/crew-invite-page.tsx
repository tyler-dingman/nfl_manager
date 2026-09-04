'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TeamThemeProvider from '@/components/team-theme-provider';
import { useAuthUser } from '@/features/auth/auth-session';
import { useTeamStore } from '@/features/team/team-store';

export default function CrewInvitePage({ token }: { token: string }) {
  const router = useRouter();
  const { user, hydrated } = useAuthUser();
  const teams = useTeamStore((s) => s.teams);
  const [invite, setInvite] = useState<any>();
  const [error, setError] = useState('');
  const autoJoinAttempted = useRef(false);
  useEffect(() => {
    void fetch(`/api/crew/invites/${token}`).then(async (r) => {
      const b = await r.json();
      if (r.ok) setInvite(b.invite);
      else setError(b.error ?? 'Invite not found.');
    });
  }, [token]);
  const join = useCallback(async () => {
    const r = await fetch(`/api/crew/invites/${token}`, { method: 'POST' });
    if (r.ok) router.replace('/crew');
    else setError((await r.json()).error ?? 'Unable to join.');
  }, [router, token]);
  useEffect(() => {
    if (
      !user ||
      !invite ||
      autoJoinAttempted.current ||
      new URLSearchParams(window.location.search).get('accept') !== '1'
    )
      return;
    autoJoinAttempted.current = true;
    void join();
  }, [invite, join, user]);
  const team = teams.find((t) => t.abbr === invite?.teamAbbr);
  return (
    <TeamThemeProvider team={team}>
      <main className="grid min-h-screen place-items-center bg-[#f7f4ee] p-5 text-[#00172B]">
        <section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl">
          <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--team-primary-text)]">
            Crew invite
          </p>
          {invite ? (
            <>
              <h1 className="mt-4 text-4xl font-black">{invite.inviterName} invited you to join</h1>
              <h2 className="mt-3 text-2xl font-black text-[var(--team-primary-text)]">
                {invite.name}
              </h2>
              <p className="mt-3 text-sm font-bold text-slate-500">
                {invite.memberCount} {invite.memberCount === 1 ? 'member' : 'members'} ·{' '}
                {invite.teamAbbr}
              </p>
              {hydrated && user ? (
                <button
                  onClick={join}
                  className="team-primary-filled mt-8 w-full rounded-xl py-4 font-black"
                >
                  Join Crew
                </button>
              ) : (
                <div className="mt-8 grid gap-3">
                  <Link
                    href={`/login?next=${encodeURIComponent(`/crew/invite/${token}?accept=1`)}`}
                    className="team-primary-filled rounded-xl py-4 font-black"
                  >
                    Log in to join
                  </Link>
                  <Link
                    href={`/signup?next=${encodeURIComponent(`/crew/invite/${token}?accept=1`)}`}
                    className="rounded-xl border py-4 font-black"
                  >
                    Sign up with email
                  </Link>
                </div>
              )}
            </>
          ) : error ? (
            <h1 className="mt-4 text-2xl font-black">{error}</h1>
          ) : (
            <p>Loading invitation…</p>
          )}
          {error && invite ? <p className="mt-4 text-sm font-bold text-red-600">{error}</p> : null}
        </section>
      </main>
    </TeamThemeProvider>
  );
}
