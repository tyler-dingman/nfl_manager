'use client';

import AppShell from '@/components/app-shell';
import { PlayerTable } from '@/components/player-table';
import TeamHeaderSummary from '@/components/team-header-summary';
import type { PlayerRowDTO } from '@/types/player';

const freeAgents: PlayerRowDTO[] = [
  {
    id: '6',
    firstName: 'Tee',
    lastName: 'Higgins',
    position: 'WR',
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    status: 'Free Agent',
    headshotUrl: null,
  },
  {
    id: '7',
    firstName: 'Danielle',
    lastName: 'Hunter',
    position: 'DL',
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    status: 'Free Agent',
    headshotUrl: null,
  },
  {
    id: '8',
    firstName: 'Xavien',
    lastName: 'Howard',
    position: 'CB',
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    status: 'Free Agent',
    headshotUrl: null,
  },
  {
    id: '9',
    firstName: 'Kevin',
    lastName: 'Zeitler',
    position: 'OL',
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    status: 'Free Agent',
    headshotUrl: null,
  },
  {
    id: '10',
    firstName: 'Geno',
    lastName: 'Stone',
    position: 'S',
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    status: 'Free Agent',
    headshotUrl: null,
  },
];

export default function FreeAgentsPage() {
  return (
    <AppShell>
      <TeamHeaderSummary
        capSpace={50.0}
        capLimit={255.4}
        rosterCount={51}
        rosterLimit={53}
      />
      <PlayerTable data={freeAgents} variant="freeAgent" />
    </AppShell>
  );
}
