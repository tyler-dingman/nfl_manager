'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import AppShell from '@/components/app-shell';
import { PlayerTable } from '@/components/player-table';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { normalizePhase } from '@/lib/phase';
import type { PlayerRowDTO } from '@/types/player';

const samplePlayers: PlayerRowDTO[] = [
  {
    id: '1',
    firstName: 'Jordan',
    lastName: 'Love',
    position: 'QB',
    contractYearsRemaining: 3,
    capHit: '$7.2M',
    status: 'Active',
    headshotUrl: null,
  },
  {
    id: '2',
    firstName: 'Josh',
    lastName: 'Jacobs',
    position: 'RB',
    contractYearsRemaining: 2,
    capHit: '$6.4M',
    status: 'Active',
    headshotUrl: null,
  },
  {
    id: '3',
    firstName: 'Christian',
    lastName: 'Watson',
    position: 'WR',
    contractYearsRemaining: 1,
    capHit: '$3.1M',
    status: 'Injured',
    headshotUrl: null,
  },
  {
    id: '4',
    firstName: 'Elgton',
    lastName: 'Jenkins',
    position: 'OL',
    contractYearsRemaining: 4,
    capHit: '$12.9M',
    status: 'Active',
    headshotUrl: null,
  },
  {
    id: '5',
    firstName: 'Carrington',
    lastName: 'Valentine',
    position: 'CB',
    contractYearsRemaining: 3,
    capHit: '$1.1M',
    status: 'Practice Squad',
    headshotUrl: null,
  },
];

const PHASE_NEXT_ACTION = {
  Offseason: {
    title: 'Offseason priorities',
    body: 'Get your team under the cap and prepare for Free Agency by cutting, trading, or re-signing players.',
    cta: 'Review roster',
    href: '/roster',
  },
  FreeAgency: {
    title: 'Free Agency',
    body: 'Improve your roster by signing talent while staying under the cap.',
    cta: 'View free agents',
    href: '/free-agents',
  },
  Draft: {
    title: 'Draft prep',
    body: 'Finalize your board and make picks to build your future roster.',
    cta: 'Go to Draft Room',
    href: '/draft/room?mode=mock',
  },
} as const;

export default function HomePage() {
  const router = useRouter();
  const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
  const setPhase = useSaveStore((state) => state.setPhase);
  const phase = useSaveStore((state) => state.phase);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const onboardingComplete = window.localStorage.getItem('onboardingComplete') === 'true';

    if (!onboardingComplete) {
      router.replace('/onboarding');
      return;
    }

    const selectedTeam = window.localStorage.getItem('onboardingTeamId');
    const selectedPhase = window.localStorage.getItem('onboardingPhase');

    if (selectedTeam) {
      setSelectedTeamId(selectedTeam);
    }

    if (selectedPhase) {
      setPhase(selectedPhase);
    }

    setIsReady(true);
  }, [router, setPhase, setSelectedTeamId]);

  const nextAction = useMemo(() => PHASE_NEXT_ACTION[normalizePhase(phase)], [phase]);

  if (!isReady) {
    return null;
  }

  return (
    <AppShell>
      <section
        className="mb-6 rounded-2xl border border-transparent p-5"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--team-primary) 6%, transparent)',
        }}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Next Action</p>
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{nextAction.title}</h2>
            <p className="text-sm text-muted-foreground">{nextAction.body}</p>
          </div>
          <button
            type="button"
            onClick={() => router.push(nextAction.href)}
            className="w-full rounded-full px-4 py-2 text-sm font-semibold text-slate-900 md:w-auto"
            style={{ backgroundColor: 'var(--team-secondary)' }}
          >
            {nextAction.cta}
          </button>
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-6">
          <h1 className="text-2xl font-semibold">Welcome back, GM.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track roster activity, manage contracts, and keep your scouting reports up-to-date.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Active Roster', value: '53 Players' },
              { label: 'Cap Space', value: '$18.4M' },
              { label: 'Draft Picks', value: '7 Remaining' },
              { label: 'Injuries', value: '2 Active' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border bg-slate-50 px-3 py-3 sm:px-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>
        <aside className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">Upcoming tasks</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center justify-between">
              Update depth chart
              <span className="text-xs font-semibold text-foreground">Today</span>
            </li>
            <li className="flex items-center justify-between">
              Review scouting reports
              <span className="text-xs font-semibold text-foreground">Tomorrow</span>
            </li>
            <li className="flex items-center justify-between">
              Set preseason roster
              <span className="text-xs font-semibold text-foreground">Fri</span>
            </li>
          </ul>
        </aside>
        <section className="lg:col-span-2">
          <PlayerTable data={samplePlayers} variant="roster" />
        </section>
      </div>
    </AppShell>
  );
}
