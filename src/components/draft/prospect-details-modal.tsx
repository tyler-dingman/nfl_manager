'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import { ProspectIndicators } from '@/components/draft/prospect-indicators';
import { Button } from '@/components/ui/button';
import { buildProspectDetailsModel } from '@/lib/draft-prospect-details';
import type { DraftBoardEntry } from '@/lib/draft-board';
import type { DraftRun } from '@/lib/draft-intelligence';
import { cn } from '@/lib/utils';
import type { PlayerRowDTO } from '@/types/player';

type ProspectDetailsModalProps = {
  open: boolean;
  player: PlayerRowDTO | null;
  boardEntry?: DraftBoardEntry | null;
  teamNeeds: string[];
  activeRuns?: DraftRun[];
  canDraft?: boolean;
  onDraft?: (player: PlayerRowDTO) => void;
  onClose: () => void;
};

const renderProspectAvatar = (player: PlayerRowDTO, name: string) => {
  if (player.headshotUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.headshotUrl}
        alt={name}
        className="h-24 w-24 rounded-2xl object-cover object-top shadow-sm sm:h-28 sm:w-28"
        loading="lazy"
        decoding="async"
      />
    );
  }

  const initials = `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`.trim() || 'DP';
  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 text-2xl font-semibold text-slate-600 shadow-sm sm:h-28 sm:w-28">
      {initials}
    </div>
  );
};

const fitTone = (fitScore: number) => {
  if (fitScore >= 86) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (fitScore >= 75) return 'text-sky-700 bg-sky-50 border-sky-200';
  if (fitScore >= 62) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-slate-700 bg-slate-50 border-slate-200';
};

export function ProspectDetailsModal({
  open,
  player,
  boardEntry,
  teamNeeds,
  activeRuns = [],
  canDraft = false,
  onDraft,
  onClose,
}: ProspectDetailsModalProps) {
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, open]);

  const model = React.useMemo(() => {
    if (!open || !player) return null;
    return buildProspectDetailsModel({ player, boardEntry, teamNeeds, activeRuns });
  }, [activeRuns, boardEntry, open, player, teamNeeds]);

  if (!open || !player || !model) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:max-w-4xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Prospect Details
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground sm:text-xl">{model.name}</h2>
          </div>
          <Button
            ref={closeButtonRef}
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close prospect details"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <section className="rounded-3xl border border-border bg-slate-50/70 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="shrink-0">{renderProspectAvatar(player, model.name)}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-2xl font-semibold text-foreground sm:text-3xl">{model.name}</h3>
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {model.position}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {model.school} · {model.projectedRange}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>{model.age ? `Age ${model.age}` : 'Age —'}</span>
                    <span>{model.height ?? 'Height —'}</span>
                    <span>{model.weight ? `${model.weight} lbs` : 'Weight —'}</span>
                    <span>{model.archetype}</span>
                  </div>
                  <ProspectIndicators indicators={model.indicators} className="mt-4" />
                </div>
              </div>

              <div className="shrink-0 rounded-2xl border border-border bg-white px-4 py-3 text-center shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Grade
                </div>
                <div className="mt-1 text-4xl font-semibold leading-none text-foreground">
                  {model.ratingDisplay}
                </div>
              </div>
            </div>
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Player Snapshot
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">{model.summary}</p>
              </section>

              <section className="grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Strengths
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    {model.strengths.map((strength) => (
                      <li key={strength} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Weaknesses
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    {model.weaknesses.map((weakness) => (
                      <li key={weakness} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        <span>{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Team Fit
                </p>
                <div
                  className={cn(
                    'mt-3 rounded-2xl border px-4 py-4',
                    fitTone(model.fitScore),
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{model.fitLabel}</span>
                    <span className="text-2xl font-semibold">{model.fitScore}</span>
                  </div>
                  <p className="mt-2 text-sm">{model.fitReason}</p>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Outlook
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">{model.outlook}</p>
              </section>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
