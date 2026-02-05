'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import AppShell from '@/components/app-shell';
import CutPlayerModal from '@/components/cut-player-modal';
import { PlayerTable } from '@/components/player-table';
import { useRosterQuery } from '@/features/players/queries';
import { useSaveStore } from '@/features/save/save-store';
import type { PlayerRowDTO } from '@/types/player';

export default function RosterPage() {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const teamId = useSaveStore((state) => state.teamId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const refreshSaveHeader = useSaveStore((state) => state.refreshSaveHeader);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const { data: players, refresh: refreshPlayers } = useRosterQuery(saveId);
  const [activeCutPlayer, setActiveCutPlayer] = useState<PlayerRowDTO | null>(null);

  const handleSubmitCut = async () => {
    if (!saveId || !activeCutPlayer) {
      return;
    }

    const response = await fetch('/api/actions/cut-player', {
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
        createdAt: string;
      };
    };
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Unable to cut player right now.');
    }

    if (data.header) {
      setSaveHeader(data.header);
    }

    await Promise.all([refreshSaveHeader(), refreshPlayers()]);
  };

  return (
    <AppShell>
      <PlayerTable
        data={players}
        variant="roster"
        onCutPlayer={setActiveCutPlayer}
        onTradePlayer={(player) => router.push(`/manage/trades?playerId=${player.id}`)}
      />
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
