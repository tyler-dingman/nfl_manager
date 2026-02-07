'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import AppShell from '@/components/app-shell';
import CutPlayerModal from '@/components/cut-player-modal';
import NewsTicker from '@/components/news-ticker';
import { PlayerTable } from '@/components/player-table';
import { useRosterQuery } from '@/features/players/queries';
import { useSaveStore } from '@/features/save/save-store';
import { formatCapMillions } from '@/lib/cap-space';
import { apiFetch } from '@/lib/api';
import type { PlayerRowDTO } from '@/types/player';

export default function HomePage() {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const teamId = useSaveStore((state) => state.teamId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const rosterCount = useSaveStore((state) => state.rosterCount);
  const refreshSaveHeader = useSaveStore((state) => state.refreshSaveHeader);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const hasHydrated = useSaveStore((state) => state.hasHydrated);
  const { data: players, refresh: refreshPlayers } = useRosterQuery(saveId, teamAbbr);
  const [activeCutPlayer, setActiveCutPlayer] = useState<PlayerRowDTO | null>(null);

  useEffect(() => {
    if (hasHydrated && !saveId && !teamAbbr) {
      router.replace('/teams');
    }
  }, [hasHydrated, router, saveId, teamAbbr]);

  const handleSubmitCut = async () => {
    if (!saveId || !activeCutPlayer) {
      return;
    }

    const response = await apiFetch('/api/actions/cut-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId,
        playerId: activeCutPlayer.id,
        teamId: teamId || undefined,
        teamAbbr: teamAbbr || undefined,
      }),
    });

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      header?: {
        id: string;
        teamAbbr: string;
        capSpace: number;
        capLimit: number;
        rosterCount: number;
        rosterLimit: number;
        phase: string;
        unlocked?: { freeAgency: boolean; draft: boolean };
        createdAt: string;
      };
    };
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Unable to cut player right now.');
    }

    if (data.header) {
      setSaveHeader({
        ...data.header,
        unlocked: data.header.unlocked ?? { freeAgency: false, draft: false },
      });
    }

    await Promise.all([refreshSaveHeader(), refreshPlayers()]);
  };

  return (
    <AppShell>
      <NewsTicker saveId={saveId} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Welcome back, GM.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track roster activity, manage contracts, and keep your scouting reports up-to-date.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Active Roster', value: `${rosterCount} Players` },
              {
                label: 'Cap Space',
                value: formatCapMillions(capSpace * 1_000_000),
                valueClassName: capSpace < 0 ? 'text-destructive' : 'text-foreground',
              },
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
                <p
                  className={`mt-2 text-lg font-semibold ${
                    stat.valueClassName ?? 'text-foreground'
                  }`}
                >
                  {stat.value}
                </p>
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
          <PlayerTable data={players} variant="roster" onCutPlayer={setActiveCutPlayer} />
        </section>
      </div>
      {activeCutPlayer ? (
        <CutPlayerModal
          player={activeCutPlayer}
          isOpen={Boolean(activeCutPlayer)}
          currentCapSpace={capSpace}
          onClose={() => setActiveCutPlayer(null)}
          onSubmit={handleSubmitCut}
        />
      ) : null}
    </AppShell>
  );
}
