'use client';

import { Award, ChevronRight, ShieldCheck, Sparkles } from 'lucide-react';

import { YourDraftSoFar } from '@/components/draft/your-draft-so-far';
import { Badge } from '@/components/ui/badge';
import type { DraftClassSummary, DraftPickEvaluation } from '@/lib/draft-intelligence';
import type { DraftPickDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';

type DraftRecapEntry = {
  pick: DraftPickDTO;
  player: PlayerRowDTO;
  evaluation: DraftPickEvaluation;
};

type DraftRecapProps = {
  summary: DraftClassSummary;
  entries: DraftRecapEntry[];
};

export function DraftRecap({ summary, entries }: DraftRecapProps) {
  return (
    <div className="space-y-5">
      <YourDraftSoFar summary={summary} />

      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Draft Recap
            </p>
            <h3 className="mt-1 text-xl font-semibold text-foreground">Class report card</h3>
          </div>
          <div className="rounded-2xl border border-border bg-slate-50 px-4 py-2 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Final Grade
            </p>
            <p className="mt-1 text-3xl font-bold text-foreground">{summary.overallGrade}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Best Pick
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {summary.bestPickLabel ?? 'Still waiting on your first pick'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Biggest Swing
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {summary.biggestReachLabel ?? 'No major reaches'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Needs Addressed
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {summary.needsAddressed} roster need{summary.needsAddressed === 1 ? '' : 's'} improved
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-slate-500" />
          <h3 className="text-lg font-semibold text-foreground">Pick-by-pick review</h3>
        </div>

        <div className="mt-4 space-y-3">
          {entries.map(({ pick, player, evaluation }) => (
            <div key={pick.id} className="rounded-xl border border-border bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-foreground">
                      {player.firstName} {player.lastName}
                    </p>
                    <Badge variant="secondary">{player.position}</Badge>
                    {evaluation.tags.map((tag) => (
                      <Badge key={`${pick.id}-${tag}`} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pick {pick.overall} · Round {pick.round} · {player.college ?? 'College TBD'}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-white px-3 py-2 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Draft IQ
                  </p>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {pick.grade ?? evaluation.grade}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {evaluation.reasons.map((reason) => (
                  <div
                    key={`${pick.id}-${reason}`}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    {reason.includes('need') ? (
                      <ShieldCheck className="mt-0.5 h-4 w-4 text-blue-600" />
                    ) : reason.includes('value') || reason.includes('Sleeper') ? (
                      <Sparkles className="mt-0.5 h-4 w-4 text-emerald-600" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 text-slate-400" />
                    )}
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
