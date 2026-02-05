'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { DraftOrderTeam } from './draft-utils';

type DraftStagePanelProps = {
  selectedPick: DraftOrderTeam;
  onTheClockPickNumber: number;
  onStartDraft: () => void;
  isStartingDraft: boolean;
};

export function DraftStagePanel({
  selectedPick,
  onTheClockPickNumber,
  onStartDraft,
  isStartingDraft,
}: DraftStagePanelProps) {
  const isOnClock = selectedPick.pickNumber === onTheClockPickNumber;

  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-foreground">2026 NFL Draft — Round 1</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick {selectedPick.pickNumber} — {selectedPick.name} —{' '}
        {isOnClock ? 'On the Clock' : 'Up Next'}
      </p>

      <div
        className="mt-4 rounded-2xl border p-6"
        style={{
          borderColor: `${selectedPick.primaryColor}55`,
          background: `linear-gradient(140deg, ${selectedPick.primaryColor}22, ${selectedPick.secondaryColor}22)`,
        }}
      >
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Draft Stage</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{selectedPick.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Selection #{selectedPick.pickNumber}
            </p>
            {isOnClock ? (
              <Badge variant="success" className="mt-3">
                On the Clock
              </Badge>
            ) : null}
          </div>
          <img src={selectedPick.logoUrl} alt={`${selectedPick.name} logo`} className="h-24 w-24" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {selectedPick.needs.map((need) => (
            <Badge key={need} variant="outline">
              {need}
            </Badge>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-3 rounded-xl border border-border bg-slate-50 p-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Speed</span>
            <span>Slow / Fast / Turbo</span>
          </div>
          <input type="range" min={1} max={3} defaultValue={1} className="w-full" disabled />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled>
            Settings
          </Button>
          <Button type="button" onClick={onStartDraft} disabled={isStartingDraft}>
            {isStartingDraft ? 'Starting…' : 'Start Draft'}
          </Button>
          <Button type="button" variant="outline" disabled title="Coming soon">
            Offer Trade
          </Button>
        </div>
      </div>
    </section>
  );
}
