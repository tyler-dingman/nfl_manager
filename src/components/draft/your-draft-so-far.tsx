'use client';

import { BadgeCheck, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { DraftClassSummary } from '@/lib/draft-intelligence';

type YourDraftSoFarProps = {
  summary: DraftClassSummary;
};

export function YourDraftSoFar({ summary }: YourDraftSoFarProps) {
  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Your Draft So Far
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">Class snapshot</h2>
        </div>
        <div className="rounded-2xl border border-border bg-slate-50 px-4 py-2 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Grade
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.overallGrade}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Picks Made
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">{summary.pickCount}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Needs Hit
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">{summary.needsAddressed}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Value Added
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">{summary.totalValueAdded.toFixed(1)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {summary.positionsDrafted.length > 0 ? (
          summary.positionsDrafted.map((position) => (
            <Badge key={position} variant="secondary">
              {position}
            </Badge>
          ))
        ) : (
          <Badge variant="outline">No picks yet</Badge>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {summary.summaryLines.map((line) => (
          <div key={line} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 text-slate-400" />
            <span>{line}</span>
          </div>
        ))}
        {summary.bestPickLabel ? (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <BadgeCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
            <span>Best pick so far: {summary.bestPickLabel}</span>
          </div>
        ) : null}
        {summary.biggestReachLabel ? (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <TrendingUp className="mt-0.5 h-4 w-4 text-amber-600" />
            <span>Biggest swing: {summary.biggestReachLabel}</span>
          </div>
        ) : null}
        {summary.needsAddressed > 0 ? (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-blue-600" />
            <span>{summary.needsAddressed} roster need{summary.needsAddressed > 1 ? 's' : ''} addressed</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
