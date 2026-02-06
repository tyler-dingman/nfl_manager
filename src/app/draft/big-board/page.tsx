'use client';

import AppShell from '@/components/app-shell';
import { PlayerTable } from '@/components/player-table';
import { buildTop32Prospects } from '@/server/data/prospects-top32';

export default function DraftBigBoardPage() {
  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">Draft Big Board</h1>
        <p className="text-sm text-muted-foreground">
          Sort and filter prospects by availability, position, and search.
        </p>
      </div>
      <PlayerTable data={buildTop32Prospects()} variant="draft" />
    </AppShell>
  );
}
