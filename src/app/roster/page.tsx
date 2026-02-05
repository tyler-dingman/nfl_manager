'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import AppShell from '@/components/app-shell';
import { PlayerTable } from '@/components/player-table';
import TeamHeaderSummary from '@/components/team-header-summary';
import { useSaveStore } from '@/features/save/save-store';
import { normalizePhase } from '@/lib/phase';
import type { PlayerRowDTO } from '@/types/player';

export default function RosterPage() {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const phase = useSaveStore((state) => state.phase);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const rosterCount = useSaveStore((state) => state.rosterCount);
  const rosterLimit = useSaveStore((state) => state.rosterLimit);
  const setPhase = useSaveStore((state) => state.setPhase);
  const refreshSaveHeader = useSaveStore((state) => state.refreshSaveHeader);
  const [isTransitioningPhase, setIsTransitioningPhase] = useState(false);
  const [players, setPlayers] = useState<PlayerRowDTO[]>([]);

  const loadRoster = useCallback(async () => {
    if (!saveId) {
      return;
    }

    const response = await fetch(`/api/roster?saveId=${saveId}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as PlayerRowDTO[];
    setPlayers(data);
  }, [saveId]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    const handleFocus = () => {
      loadRoster();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadRoster]);

  const isOffseason = normalizePhase(phase) === 'Offseason';

  const handleEnterFreeAgency = async () => {
    if (!saveId || isTransitioningPhase) {
      return;
    }

    setIsTransitioningPhase(true);
    const response = await fetch('/api/saves/phase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId, phase: 'FreeAgency' }),
    });

    if (!response.ok) {
      setIsTransitioningPhase(false);
      return;
    }

    setPhase('FreeAgency');
    window.localStorage.setItem('onboardingPhase', 'FreeAgency');
    await refreshSaveHeader();
    router.push('/free-agents');
  };

  return (
    <AppShell>
      {isOffseason ? (
        <section className="mb-4 rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Once you&apos;re under the cap, move to Free Agency.
            </p>
            <button
              type="button"
              onClick={handleEnterFreeAgency}
              disabled={isTransitioningPhase}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isTransitioningPhase ? 'Entering...' : 'Enter Free Agency'}
            </button>
          </div>
        </section>
      ) : null}
      <TeamHeaderSummary
        capSpace={capSpace}
        capLimit={capLimit}
        rosterCount={rosterCount}
        rosterLimit={rosterLimit}
      />
      <PlayerTable
        data={players}
        variant="roster"
        onTradePlayer={(player) => router.push(`/manage/trades?playerId=${player.id}`)}
      />
    </AppShell>
  );
}
