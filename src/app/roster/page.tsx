'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import AppShell from '@/components/app-shell';
import { PlayerTable } from '@/components/player-table';
import TeamHeaderSummary from '@/components/team-header-summary';
import { useSaveStore } from '@/features/save/save-store';
import type { PlayerRowDTO } from '@/types/player';

export default function RosterPage() {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const rosterCount = useSaveStore((state) => state.rosterCount);
  const rosterLimit = useSaveStore((state) => state.rosterLimit);
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

  return (
    <AppShell>
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
