'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { DraftOrderTeam } from './draft-utils';

type DraftOrderPanelProps = {
  picks: DraftOrderTeam[];
  selectedPickNumber: number;
  onTheClockPickNumber: number;
  onSelectPick: (pickNumber: number) => void;
};

export function DraftOrderPanel({
  picks,
  selectedPickNumber,
  onTheClockPickNumber,
  onSelectPick,
}: DraftOrderPanelProps) {
  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Round 1 Order</h2>
        <span className="text-xs text-muted-foreground">32 Picks</span>
      </div>
      <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
        {picks.map((pick) => {
          const isSelected = pick.pickNumber === selectedPickNumber;
          const isOnClock = pick.pickNumber === onTheClockPickNumber;

          return (
            <button
              key={pick.pickNumber}
              type="button"
              className={cn(
                'w-full rounded-xl border border-border px-3 py-2 text-left transition hover:border-primary/40',
                isSelected && 'ring-2 ring-primary/40',
              )}
              style={{ backgroundColor: `${pick.primaryColor}0f` }}
              onClick={() => onSelectPick(pick.pickNumber)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="rounded-full bg-black/80 px-2 py-1 text-xs font-semibold text-white">
                    #{pick.pickNumber}
                  </span>
                  <img src={pick.logoUrl} alt={`${pick.name} logo`} className="h-7 w-7 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{pick.name}</p>
                    <p className="text-xs text-muted-foreground">Needs: {pick.needs.join(' · ')}</p>
                  </div>
                </div>
                {isOnClock ? <Badge variant="success">On the clock</Badge> : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
