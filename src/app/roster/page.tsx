'use client';

import { useRouter } from 'next/navigation';

import AppShell from '@/components/app-shell';
import { PlayerTable } from '@/components/player-table';
import TeamHeaderSummary from '@/components/team-header-summary';
import type { PlayerRowDTO } from '@/types/player';

const rosterPlayers: PlayerRowDTO[] = [
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

export default function RosterPage() {
  const router = useRouter();

  return (
    <AppShell>
      <TeamHeaderSummary
        capSpace={50.0}
        capLimit={255.4}
        rosterCount={53}
        rosterLimit={53}
      />
      <PlayerTable
        data={rosterPlayers}
        variant="roster"
        onTradePlayer={(player) =>
          router.push(`/manage/trades?playerId=${player.id}`)
        }
      />
    </AppShell>
  );
}
