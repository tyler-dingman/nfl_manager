'use client';

import { useRouter } from 'next/navigation';

import AppShell from '@/components/app-shell';
import { PlayerTable } from '@/components/player-table';
import { useRosterQuery } from '@/features/players/queries';
import { useSaveStore } from '@/features/save/save-store';

export default function RosterPage() {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const { data: players } = useRosterQuery(saveId);

  return (
    <AppShell>
      <PlayerTable
        data={players}
        variant="roster"
        onTradePlayer={(player) => router.push(`/manage/trades?playerId=${player.id}`)}
      />
    </AppShell>
  );
}
