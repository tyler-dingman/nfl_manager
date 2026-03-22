'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import PlayerTypeIcon from '@/components/player-type-icon';
import { Button } from '@/components/ui/button';
import type { Team as StoreTeam } from '@/features/team/team-store';
import { buildPlayerDetailsModel, type PlayerDetailsSource } from '@/lib/player-details';
import { cn } from '@/lib/utils';
import type { PlayerRowDTO } from '@/types/player';
import type { TeamDTO } from '@/types/team';

type PlayerDetailsModalProps = {
  isOpen: boolean;
  source: PlayerDetailsSource | null;
  sources?: PlayerDetailsSource[];
  roster: PlayerRowDTO[];
  teams: Array<TeamDTO | StoreTeam>;
  userTeamAbbr?: string | null;
  capSpace: number;
  capLimit: number;
  onClose: () => void;
  onSelectSource?: (source: PlayerDetailsSource) => void;
};

const tierTextClass: Record<'Low' | 'Medium' | 'High', string> = {
  Low: 'text-rose-600',
  Medium: 'text-amber-600',
  High: 'text-emerald-600',
};

const meterBarClass = (index: number, value: number) => {
  const filledSegments = value >= 72 ? 3 : value >= 40 ? 2 : 1;
  return index < filledSegments ? 'bg-slate-900' : 'bg-slate-200';
};

const contractTagClass = (tag: string | null) => {
  switch (tag) {
    case 'Steal':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
    case 'Team Friendly':
    case 'Rookie Value':
      return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200';
    case 'Expensive':
      return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
  }
};

const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

const renderHeroAvatar = (name: string, headshotUrl: string | null) => {
  if (headshotUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={headshotUrl}
        alt={name}
        className="h-24 w-24 rounded-2xl object-cover object-top shadow-sm sm:h-28 sm:w-28"
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-semibold text-slate-500 shadow-sm sm:h-28 sm:w-28">
      {initialsFor(name)}
    </div>
  );
};

const getSourceId = (source: PlayerDetailsSource | null) => source?.player.id ?? null;

export default function PlayerDetailsModal({
  isOpen,
  source,
  sources = [],
  roster,
  teams,
  userTeamAbbr,
  capSpace,
  capLimit,
  onClose,
  onSelectSource,
}: PlayerDetailsModalProps) {
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const currentSourceId = React.useMemo(() => getSourceId(source), [source]);
  const currentIndex = React.useMemo(
    () => sources.findIndex((entry) => getSourceId(entry) === currentSourceId),
    [currentSourceId, sources],
  );
  const previousSource = currentIndex > 0 ? sources[currentIndex - 1] : null;
  const nextSource =
    currentIndex >= 0 && currentIndex < sources.length - 1 ? sources[currentIndex + 1] : null;

  React.useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft' && previousSource && onSelectSource) {
        onSelectSource(previousSource);
        return;
      }
      if (event.key === 'ArrowRight' && nextSource && onSelectSource) {
        onSelectSource(nextSource);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, nextSource, onClose, onSelectSource, previousSource]);

  const model = React.useMemo(() => {
    if (!isOpen || !source) return null;
    return buildPlayerDetailsModel({
      source,
      roster,
      teams,
      userTeamAbbr,
      capSpace,
      capLimit,
    });
  }, [capLimit, capSpace, isOpen, roster, source, teams, userTeamAbbr]);

  if (!isOpen || !source || !model) {
    return null;
  }

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
              Player Details
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground sm:text-xl">{model.name}</h2>
          </div>
          <div className="flex items-center gap-1">
            {onSelectSource ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => previousSource && onSelectSource(previousSource)}
                  disabled={!previousSource}
                  aria-label="Previous player"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => nextSource && onSelectSource(nextSource)}
                  disabled={!nextSource}
                  aria-label="Next player"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : null}
            <Button
              ref={closeButtonRef}
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close player details"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <section className="rounded-3xl border border-border bg-slate-50/70 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="shrink-0">{renderHeroAvatar(model.name, model.headshotUrl)}</div>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 className="truncate text-2xl font-semibold text-foreground sm:text-3xl">
                      {model.name}
                    </h3>
                    <PlayerTypeIcon
                      indicator={model.playerTypeIndicator}
                      className="translate-y-[1px]"
                    />
                    {model.contractValueTag ? (
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold',
                          contractTagClass(model.contractValueTag),
                        )}
                      >
                        {model.contractValueTag}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{model.position}</span>
                    <span>Age {model.age ?? '—'}</span>
                    <span>{model.height ?? '—'}</span>
                    <span>{model.weight ? `${model.weight} lbs` : '—'}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {model.teamLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={model.teamLogoUrl}
                        alt={`${model.teamName ?? model.teamAbbr ?? 'Team'} logo`}
                        className="h-5 w-5 shrink-0 object-contain"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : null}
                    <span>{model.teamName ?? model.teamAbbr ?? 'Free Agent'}</span>
                    <span className="text-slate-300">•</span>
                    <span>{model.contractStatusLine}</span>
                    {model.bestRole ? (
                      <>
                        <span className="text-slate-300">•</span>
                        <span>{model.bestRole}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="shrink-0 rounded-2xl border border-border bg-white px-4 py-3 text-center shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  OVR
                </div>
                <div className="mt-1 text-4xl font-semibold leading-none text-foreground">
                  {model.ratingDisplay}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {model.meters.map((meter) => (
              <div
                key={meter.key}
                className="rounded-2xl border border-border bg-white p-3 shadow-sm"
                title={meter.helper}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {meter.label}
                  </p>
                  <span
                    className={cn('text-xs font-semibold uppercase', tierTextClass[meter.tier])}
                  >
                    {meter.tier}
                  </span>
                </div>
                <div className="mt-3 flex gap-1.5">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={`${meter.key}-${index}`}
                      className={cn(
                        'h-2 flex-1 rounded-full transition-colors',
                        meterBarClass(index, meter.value),
                      )}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-5">
              <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Player Summary
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">{model.summary}</p>
              </section>

              <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Performance Snapshot
                  </p>
                </div>
                {model.stats.length > 0 ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {model.stats.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {stat.label}
                        </p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No meaningful stat snapshot is available for this player yet.
                  </p>
                )}
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Contract + Value
                </p>
                <div className="mt-4 space-y-3">
                  {model.contract.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0"
                    >
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className="text-sm font-semibold text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Scouting Labels
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {model.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      {tag}
                    </span>
                  ))}
                  {model.tags.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No standout labels yet.</span>
                  ) : null}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Future Outlook
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
