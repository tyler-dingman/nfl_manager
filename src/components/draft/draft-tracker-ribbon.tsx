'use client';

import Image from 'next/image';
import { Pause, Play, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DraftPickDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';
import type { TeamDTO } from '@/types/team';

type DraftTrackerControls = {
  speedLevel: 0 | 1 | 2;
  showSettings: boolean;
  hasStarted: boolean;
  isBusy?: boolean;
  onSpeedChange: (value: 0 | 1 | 2) => void;
  onTogglePause: () => void;
  onStartDraft: () => void;
  onToggleSettings: () => void;
  isPaused?: boolean;
};

type DraftTrackerRibbonProps = {
  picks: DraftPickDTO[];
  currentPickIndex: number;
  prospects: PlayerRowDTO[];
  teams: TeamDTO[];
  userTeamAbbr: string;
  windowSize?: number;
  controls?: DraftTrackerControls;
};

const speedLabel = (speedLevel: number) => {
  if (speedLevel === 0) return 'Slow';
  if (speedLevel === 2) return 'Fast';
  return 'Normal';
};

export function DraftTrackerRibbon({
  picks,
  currentPickIndex,
  prospects,
  teams,
  userTeamAbbr,
  windowSize = 7,
  controls,
}: DraftTrackerRibbonProps) {
  const halfWindow = Math.floor(windowSize / 2);
  const startIndex = Math.max(0, currentPickIndex - halfWindow);
  const endIndex = Math.min(picks.length, startIndex + windowSize);
  const visiblePicks = picks.slice(startIndex, endIndex);
  const teamLookup = new Map(teams.map((team) => [team.abbr, team]));

  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Draft Tracker
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">2026 NFL Draft</h2>
          {picks[currentPickIndex] ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Round {picks[currentPickIndex].round} • Pick {picks[currentPickIndex].overall}
            </p>
          ) : null}
        </div>
        {controls ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="flex items-center gap-2 rounded-full border border-border bg-slate-50 px-3 py-2">
              <span className="text-xs font-semibold text-muted-foreground">Speed</span>
              <input
                className="w-24 sm:w-28"
              type="range"
              min={0}
              max={2}
              step={1}
              value={controls.speedLevel}
              disabled={controls.isBusy}
              onChange={(event) => controls.onSpeedChange(Number(event.target.value) as 0 | 1 | 2)}
            />
              <span className="text-xs font-semibold text-foreground">
                {speedLabel(controls.speedLevel)}
              </span>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={controls.onToggleSettings}
              disabled={controls.isBusy}
            >
              <Settings2 className="h-4 w-4" />
              Settings
            </Button>

            {!controls.hasStarted ? (
              <Button type="button" size="sm" onClick={controls.onStartDraft} disabled={controls.isBusy}>
                Start Draft
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={controls.onTogglePause}
                disabled={controls.isBusy}
              >
                {controls.isPaused ? (
                  <>
                    <Play className="h-4 w-4" />
                    Resume Draft
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4" />
                    Pause Draft
                  </>
                )}
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-3">
          {visiblePicks.map((pick, index) => {
            const absoluteIndex = startIndex + index;
            const team = teamLookup.get(pick.ownerTeamAbbr);
            const draftedPlayer = pick.selectedPlayerId
              ? prospects.find((player) => player.id === pick.selectedPlayerId)
              : null;
            const isCurrent = absoluteIndex === currentPickIndex;
            const isCompleted = Boolean(draftedPlayer);
            const isUser = pick.ownerTeamAbbr === userTeamAbbr;

            return (
              <div
                key={pick.id}
                className={cn(
                  'w-[176px] shrink-0 rounded-2xl border px-3 py-2 transition-all',
                  isCurrent
                    ? 'border-slate-900 bg-slate-950 text-white shadow-lg ring-2 ring-slate-200'
                    : 'border-border bg-slate-50 text-foreground',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className={cn(
                        'text-[11px] font-semibold uppercase tracking-[0.2em]',
                        isCurrent ? 'text-slate-300' : 'text-muted-foreground',
                      )}
                    >
                      Pick {pick.overall}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold">
                      {team?.abbr ?? pick.ownerTeamAbbr}
                    </p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                    {team?.logoUrl ? (
                      <Image
                        src={team.logoUrl}
                        alt={`${team?.name ?? pick.ownerTeamAbbr} logo`}
                        width={26}
                        height={26}
                        className="h-6.5 w-6.5 object-contain"
                        unoptimized
                      />
                    ) : (
                      <span
                        className={cn(
                          'text-[11px] font-semibold',
                          isCurrent ? 'text-white' : 'text-slate-600',
                        )}
                      >
                        {pick.ownerTeamAbbr}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 min-h-[2rem]">
                  {draftedPlayer ? (
                    <>
                      <p
                        className={cn(
                          'line-clamp-1 text-sm font-semibold',
                          isCurrent ? 'text-white' : 'text-foreground',
                        )}
                      >
                        {draftedPlayer.firstName} {draftedPlayer.lastName}
                      </p>
                      <p
                        className={cn(
                          'mt-0.5 text-[11px]',
                          isCurrent ? 'text-slate-300' : 'text-muted-foreground',
                        )}
                      >
                        {draftedPlayer.position}
                      </p>
                    </>
                  ) : (
                    <p
                      className={cn(
                        'line-clamp-2 text-[11px] leading-4',
                        isCurrent ? 'text-slate-300' : 'text-muted-foreground',
                      )}
                    >
                      {team?.teamNeeds?.slice(0, 2).join(' · ') || 'Best player available'}
                    </p>
                  )}
                </div>

                {isUser ? (
                  <p
                    className={cn(
                      'mt-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                      isCurrent ? 'text-slate-300' : 'text-slate-500',
                    )}
                  >
                    Your pick
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {controls?.showSettings ? (
        <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Draft Clock
            </p>
            <p className="mt-1">User picks get 90 seconds before autopick triggers.</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Trade Chaos
            </p>
            <p className="mt-1">Draft-day calls surface around premium picks and on-the-clock pressure.</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Board Mode
            </p>
            <p className="mt-1">Prospects are ranked with live need, value, and run-risk context.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
