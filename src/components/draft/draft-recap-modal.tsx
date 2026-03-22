'use client';

import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { DraftRecap } from '@/components/draft/draft-recap';
import type { DraftClassSummary, DraftPickEvaluation } from '@/lib/draft-intelligence';
import type { DraftPickDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';

type DraftRecapEntry = {
  pick: DraftPickDTO;
  player: PlayerRowDTO;
  evaluation: DraftPickEvaluation;
};

type DraftRecapModalProps = {
  open: boolean;
  teamName: string;
  roundCount: number;
  teamNeeds: string[];
  summary: DraftClassSummary;
  entries: DraftRecapEntry[];
  onContinue: () => void;
};

export function DraftRecapModal({
  open,
  teamName,
  roundCount,
  teamNeeds,
  summary,
  entries,
  onContinue,
}: DraftRecapModalProps) {
  if (!open) return null;

  const addressedNeeds = teamNeeds.filter((need) =>
    entries.some((entry) => entry.player.position.toUpperCase() === need.toUpperCase()),
  );
  const remainingNeeds = teamNeeds.filter((need) => !addressedNeeds.includes(need));

  return (
    <div className="fixed inset-0 z-50 bg-black/45">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto min-h-full w-full max-w-4xl px-0 py-0 md:px-6 md:py-8">
          <div className="min-h-screen rounded-none bg-slate-50 shadow-2xl md:min-h-0 md:rounded-3xl">
            <div className="sticky top-0 z-10 border-b border-border bg-white/95 px-4 py-4 backdrop-blur md:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Draft Recap
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-foreground">Class report complete</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {teamName} • {roundCount}-Round Draft
              </p>
            </div>

            <div className="space-y-5 px-4 py-5 md:px-6 md:py-6">
              <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Overall Grade
                    </p>
                    <p className="mt-2 text-5xl font-bold text-foreground">
                      {summary.overallGrade}
                    </p>
                  </div>
                  <div className="max-w-md text-sm text-muted-foreground">
                    {summary.summaryLines[0] ??
                      'Your class added talent and direction to the roster.'}
                  </div>
                </div>
              </section>

              <DraftRecap summary={summary} entries={entries} />

              <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Need Fill Assessment
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Addressed</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {addressedNeeds.length > 0 ? (
                        addressedNeeds.map((need) => (
                          <span
                            key={need}
                            className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                          >
                            {need}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No top needs directly addressed.
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Still Watching</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {remainingNeeds.length > 0 ? (
                        remainingNeeds.map((need) => (
                          <span
                            key={need}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            {need}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Top needs were covered well.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Your Picks
                </p>
                <div className="mt-4 space-y-3">
                  {entries.map(({ pick, player, evaluation }) => (
                    <div
                      key={pick.id}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-slate-50 px-4 py-3"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-white">
                        {player.headshotUrl ? (
                          <Image
                            src={player.headshotUrl}
                            alt={`${player.firstName} ${player.lastName}`}
                            width={48}
                            height={48}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground">
                            {player.firstName.charAt(0)}
                            {player.lastName.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {player.firstName} {player.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Pick {pick.overall} • {player.position} •{' '}
                          {player.college ?? player.school ?? 'School TBD'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-white px-3 py-2 text-center">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Grade
                        </p>
                        <p className="mt-1 text-lg font-bold text-foreground">
                          {pick.grade ?? evaluation.grade}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 border-t border-border bg-white/95 px-4 py-4 backdrop-blur md:px-6">
              <Button type="button" className="h-11 w-full" onClick={onContinue}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
