'use client';

import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import { getPickHeat } from '@/lib/draft-heat';
import { cn } from '@/lib/utils';

import type { DraftOrderTeam } from './draft-utils';

type DraftOrderPanelProps = {
  picks: DraftOrderTeam[];
  selectedPickNumber: number;
  onTheClockPickNumber: number;
  onSelectPick: (pickNumber: number) => void;
  currentPickIndex?: number;
  userNextPickIndex?: number | null;
  remainingProspects?: Array<{ rank?: number; position?: string; isDrafted?: boolean }>;
};

export function DraftOrderPanel({
  picks,
  selectedPickNumber,
  onTheClockPickNumber,
  onSelectPick,
  currentPickIndex = 0,
  userNextPickIndex = null,
  remainingProspects = [],
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
          const heat = getPickHeat({
            pickIndex: pick.pickNumber,
            currentPickIndex,
            userNextPickIndex,
            teamNeeds: pick.needs,
            remainingProspects,
          });
          const heatDot =
            heat.level === 'hot'
              ? 'bg-red-400'
              : heat.level === 'warm'
                ? 'bg-amber-300'
                : 'bg-slate-300';
          const heatBar =
            heat.level === 'hot'
              ? 'bg-red-200'
              : heat.level === 'warm'
                ? 'bg-amber-200'
                : 'bg-transparent';

          return (
            <button
              key={pick.pickNumber}
              type="button"
              className={cn(
                'relative w-full rounded-xl border border-border px-3 py-2 text-left transition hover:border-primary/40',
                isSelected && 'ring-2 ring-primary/40',
              )}
              style={{ backgroundColor: `${pick.primaryColor}0f` }}
              onClick={() => onSelectPick(pick.pickNumber)}
              title={heat.reason}
            >
              <span className={cn('absolute left-0 top-0 h-full w-1 rounded-l-xl', heatBar)} />
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', heatDot)} />
                    <span className="rounded-full bg-black/80 px-2 py-1 text-xs font-semibold text-white">
                      #{pick.pickNumber}
                    </span>
                  </div>
                  <Image
                    src={pick.logoUrl}
                    alt={`${pick.name} logo`}
                    width={28}
                    height={28}
                    className="h-7 w-7 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{pick.name}</p>
                    <p className="text-xs text-muted-foreground">Needs: {pick.needs.join(' · ')}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground sm:hidden">
                      {heat.reason}
                    </p>
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
