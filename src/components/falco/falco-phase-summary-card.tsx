'use client';

import FalcoAvatar from '@/components/falco/falco-avatar';
import { buildPhaseSummary, type FalcoPhase } from '@/lib/falco-phase-summary';
import { cn } from '@/lib/utils';

type FalcoPhaseSummaryCardProps = {
  phase: FalcoPhase;
  capSpace: number;
  rosterCount: number;
  rosterLimit: number;
  seed: string;
  className?: string;
};

const gradeStyles: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700',
  B: 'bg-sky-100 text-sky-700',
  C: 'bg-amber-100 text-amber-700',
  D: 'bg-orange-100 text-orange-700',
  F: 'bg-rose-100 text-rose-700',
};

export default function FalcoPhaseSummaryCard({
  phase,
  capSpace,
  rosterCount,
  rosterLimit,
  seed,
  className,
}: FalcoPhaseSummaryCardProps) {
  const summary = buildPhaseSummary({ phase, capSpace, rosterCount, rosterLimit, seed });

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <FalcoAvatar size={28} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Falco Summary
            </p>
            <p className="mt-1 text-base font-semibold text-foreground">{summary.quote}</p>
            <p className="mt-2 text-sm text-muted-foreground">{summary.implication}</p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-semibold',
            gradeStyles[summary.grade] ?? 'bg-slate-100 text-slate-700',
          )}
        >
          {summary.grade}
        </span>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        Cap space: {capSpace.toFixed(1)}M · Roster: {rosterCount}/{rosterLimit}
      </div>
    </div>
  );
}
