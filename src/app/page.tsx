'use client';

import AppShell from '@/components/app-shell';
import { PlayerTable } from '@/components/player-table';
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

export default function HomePage() {
  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
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
                className="rounded-xl border border-border bg-slate-50 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>
        <aside className="rounded-2xl border border-border bg-white p-6 shadow-sm">
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
