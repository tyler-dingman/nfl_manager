'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpRight, Check, Clock3, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import type { CatchUpResponse } from '@/features/catch-up/types';
import { readCanonicalFanTeamPreference } from '@/features/team/fan-team-preference';
import { useTeamStore } from '@/features/team/team-store';

export default function CatchUpExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teams = useTeamStore((state) => state.teams);
  const requestedTeam = searchParams?.get('team')?.toUpperCase();
  const demoMode = searchParams?.get('demo');
  const [persistedTeam, setPersistedTeam] = useState<string | null>(null);
  const [data, setData] = useState<CatchUpResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [yardAward, setYardAward] = useState<{
    yardsAwarded: number;
    touchdownsEarned: number;
    unlockedRewards: Array<{ id: string; title: string }>;
  } | null>(null);
  const teamId = requestedTeam ?? persistedTeam;
  const team = useMemo(() => teams.find((candidate) => candidate.abbr === teamId), [teamId, teams]);

  useEffect(() => {
    void readCanonicalFanTeamPreference().then(setPersistedTeam);
  }, []);
  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const query = new URLSearchParams({ team: teamId });
    if (demoMode) query.set('demo', demoMode);
    void fetch(`/api/catch-up?${query}`, { cache: 'no-store', signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { catchUp?: CatchUpResponse } | null) => setData(body?.catchUp ?? null))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [demoMode, teamId]);

  const complete = async () => {
    if (!teamId || completing) return;
    setCompleting(true);
    const response = await fetch('/api/catch-up/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamId }),
    });
    const body = (await response.json()) as {
      caughtUpAt?: string;
      yardAward?: {
        yardsAwarded: number;
        touchdownsEarned: number;
        unlockedRewards: Array<{ id: string; title: string }>;
      };
    };
    if (response.ok) {
      setCompletedAt(body.caughtUpAt ?? new Date().toISOString());
      setYardAward(body.yardAward ?? null);
    }
    setCompleting(false);
  };

  return (
    <TeamThemeProvider team={team}>
      <div className="min-h-screen bg-[#f7f4ee] text-[#00172B]">
        <MainSiteHeader teamAbbr={team?.abbr} active={null} />
        <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="flex flex-wrap items-end justify-between gap-5 border-b border-[#00172B]/10 pb-8">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-[var(--team-primary-text)]">
                <RotateCcw className="h-4 w-4" /> Get caught up
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">
                While you were away
              </h1>
              {data ? (
                <p className="mt-4 flex items-center gap-2 font-semibold text-[#00172B]/50">
                  <Clock3 className="h-4 w-4" /> Since{' '}
                  {new Date(data.baselineAt).toLocaleString([], {
                    weekday: 'long',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              ) : null}
            </div>
            {teamId ? (
              <button
                type="button"
                onClick={() => router.push(`/three-and-out?team=${teamId}`)}
                className="text-sm font-black text-[var(--team-primary-text)]"
              >
                Open Three and Out →
              </button>
            ) : null}
          </div>

          {loading ? <div className="mt-8 h-72 animate-pulse rounded-3xl bg-white" /> : null}
          {!loading && !team ? (
            <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-sm">
              <h2 className="text-2xl font-black">Choose a team first.</h2>
              <Link
                href="/"
                className="mt-4 inline-flex font-black text-[var(--team-primary-text)]"
              >
                Return home →
              </Link>
            </div>
          ) : null}
          {!loading && data && (!data.eligible || !data.items.length) ? (
            <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-sm sm:p-12">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <Check className="h-7 w-7" />
              </span>
              <h2 className="mt-5 text-3xl font-black">
                {data.eligible ? 'You’re caught up.' : 'Your baseline is set.'}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-slate-500">
                {data.eligible
                  ? 'Nothing important has changed since your last catch-up.'
                  : 'Come back after the team picture changes and Down & Distance will show what matters.'}
              </p>
            </div>
          ) : null}

          {!loading && data?.items.length ? (
            <div className="mt-8 space-y-5">
              {data.items.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                  <div className="border-l-4 border-[var(--primary)] p-6 sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="rounded-full bg-[var(--primary)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--team-on-primary)]">
                        {item.type}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        {item.sourceCount} {item.sourceCount === 1 ? 'source' : 'sources'}
                      </span>
                    </div>
                    <h2 className="mt-5 text-2xl font-black leading-tight sm:text-3xl">
                      {item.headline}
                    </h2>
                    <p className="mt-4 text-base leading-7 text-slate-600">{item.summary}</p>
                    {item.whatChanged ? (
                      <div className="mt-6 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2">
                        <div>
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--team-primary-text)]">
                            What changed
                          </h3>
                          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                            {item.whatChanged}
                          </p>
                        </div>
                        <div>
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--team-primary-text)]">
                            Why it matters
                          </h3>
                          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                            {item.whyItMatters}
                          </p>
                        </div>
                      </div>
                    ) : null}
                    {item.sources.length ? (
                      <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
                        {item.sources.slice(0, 3).map((source) => (
                          <a
                            key={source.id}
                            href={source.sourceUrl}
                            target={source.sourceUrl.startsWith('http') ? '_blank' : undefined}
                            rel={source.sourceUrl.startsWith('http') ? 'noreferrer' : undefined}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#00172B]/10 px-3 py-2 text-xs font-black hover:border-[var(--primary)]"
                          >
                            {source.sourceName} <ArrowUpRight className="h-3.5 w-3.5" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
              <section className="rounded-3xl bg-[#00172B] p-7 text-center text-white sm:p-10">
                {completedAt ? (
                  <>
                    <Check className="mx-auto h-8 w-8 text-[var(--team-secondary-on-dark)]" />
                    <h2 className="mt-3 text-2xl font-black">You’re caught up.</h2>
                    <p className="mt-2 text-sm font-semibold text-white/55">
                      Caught up through {new Date(completedAt).toLocaleString()}.
                    </p>
                    {yardAward?.yardsAwarded ? (
                      <p className="mt-4 text-xs font-black uppercase tracking-[.2em] text-[var(--team-secondary-on-dark)]">
                        Move the Chains · +{yardAward.yardsAwarded} yard
                      </p>
                    ) : null}
                    {yardAward?.touchdownsEarned ? (
                      <p className="mt-2 font-black text-[#F4D9B7]">Touchdown!</p>
                    ) : null}
                    {yardAward?.unlockedRewards.map((reward) => (
                      <Link
                        key={reward.id}
                        href="/rewards"
                        className="mt-2 block font-black text-[#F4D9B7]"
                      >
                        Reward unlocked · {reward.title} →
                      </Link>
                    ))}
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-black">That’s the team picture right now.</h2>
                    <p className="mt-2 text-sm font-semibold text-white/55">
                      This advances your baseline across every signed-in device.
                    </p>
                    <button
                      type="button"
                      disabled={completing}
                      onClick={complete}
                      className="mt-6 rounded-full bg-[var(--secondary)] px-6 py-3 text-sm font-black text-[var(--team-on-secondary)] disabled:opacity-50"
                    >
                      {completing ? 'Saving…' : 'Mark me caught up'}
                    </button>
                  </>
                )}
              </section>
            </div>
          ) : null}
        </main>
      </div>
    </TeamThemeProvider>
  );
}
