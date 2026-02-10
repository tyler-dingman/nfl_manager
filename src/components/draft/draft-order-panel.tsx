'use client';

import { DraftTeamCard, type DraftTeamCardVariant } from '@/components/draft/draft-team-card';
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
  variant?: DraftTeamCardVariant;
};

export function DraftOrderPanel({
  picks,
  selectedPickNumber,
  onTheClockPickNumber,
  onSelectPick,
  currentPickIndex = 0,
  userNextPickIndex = null,
  remainingProspects = [],
  variant = 'pre',
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
          const heatBar =
            heat.level === 'hot'
              ? 'bg-red-200'
              : heat.level === 'warm'
                ? 'bg-amber-200'
                : 'bg-transparent';

          return (
            <div key={pick.pickNumber} className="relative">
              <span className={cn('absolute left-0 top-0 h-full w-1 rounded-l-xl', heatBar)} />
              <DraftTeamCard
                variant={variant}
                model={{
                  pickNumber: pick.pickNumber,
                  teamName: pick.name,
                  logoUrl: pick.logoUrl,
                  needs: pick.needs,
                  record: pick.record ?? null,
                  note: pick.note ?? null,
                  isOnClock,
                  isSelected,
                }}
                onClick={() => onSelectPick(pick.pickNumber)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
