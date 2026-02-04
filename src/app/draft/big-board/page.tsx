'use client';

import AppShell from '@/components/app-shell';
import { PlayerTable } from '@/components/player-table';
import type { PlayerRowDTO } from '@/types/player';

const mockProspects: PlayerRowDTO[] = [
  {
    id: 'p1',
    firstName: 'Caleb',
    lastName: 'Williams',
    position: 'QB',
    rank: 1,
    college: 'USC',
    grade: '94.1',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p2',
    firstName: 'Marvin',
    lastName: 'Harrison Jr.',
    position: 'WR',
    rank: 2,
    college: 'Ohio State',
    grade: '93.4',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Drafted',
    isDrafted: true,
  },
  {
    id: 'p3',
    firstName: 'Drake',
    lastName: 'Maye',
    position: 'QB',
    rank: 3,
    college: 'North Carolina',
    grade: '92.8',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p4',
    firstName: 'Malik',
    lastName: 'Nabers',
    position: 'WR',
    rank: 4,
    college: 'LSU',
    grade: '92.1',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p5',
    firstName: 'Joe',
    lastName: 'Alt',
    position: 'OL',
    rank: 5,
    college: 'Notre Dame',
    grade: '91.7',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Drafted',
    isDrafted: true,
  },
  {
    id: 'p6',
    firstName: 'Dallas',
    lastName: 'Turner',
    position: 'LB',
    rank: 6,
    college: 'Alabama',
    grade: '90.9',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p7',
    firstName: 'Brock',
    lastName: 'Bowers',
    position: 'TE',
    rank: 7,
    college: 'Georgia',
    grade: '90.2',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p8',
    firstName: 'Jared',
    lastName: 'Verse',
    position: 'DL',
    rank: 8,
    college: 'Florida State',
    grade: '89.8',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Drafted',
    isDrafted: true,
  },
  {
    id: 'p9',
    firstName: 'Quinyon',
    lastName: 'Mitchell',
    position: 'CB',
    rank: 9,
    college: 'Toledo',
    grade: '89.1',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
  {
    id: 'p10',
    firstName: 'Terrion',
    lastName: 'Arnold',
    position: 'CB',
    rank: 10,
    college: 'Alabama',
    grade: '88.6',
    projectedRound: 'Round 1',
    contractYearsRemaining: 0,
    capHit: '-',
    status: 'Available',
    isDrafted: false,
  },
];

export default function DraftBigBoardPage() {
  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">Draft Big Board</h1>
        <p className="text-sm text-muted-foreground">
          Sort and filter prospects by availability, position, and search.
        </p>
      </div>
      <PlayerTable data={mockProspects} variant="draftProspects" />
    </AppShell>
  );
}
