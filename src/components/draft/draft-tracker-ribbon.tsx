'use client';

import Image from 'next/image';
import { ArrowLeftRight, Pause, Play, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getReadableTextColor } from '@/lib/color-utils';
import { getStoredPickGrade } from '@/lib/draft-grading';
import { cn } from '@/lib/utils';
import type { DraftPickDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';
import type { TeamDTO } from '@/types/team';

type DraftTrackerControls = {
  speedLevel: 0 | 1 | 2;
  showSettings: boolean;
  hasStarted: boolean;
  isBusy?: boolean;
  canOfferTrade?: boolean;
  canSkipToUserPick?: boolean;
  onSpeedChange: (value: 0 | 1 | 2) => void;
  onTogglePause: () => void;
  onStartDraft: () => void;
  onOfferTrade?: () => void;
  onSkipToUserPick?: () => void;
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
  const currentPick = picks[currentPickIndex] ?? null;
  const currentRound = currentPick?.round ?? picks[0]?.round ?? 1;
  const roundPicks = picks.filter((pick) => pick.round === currentRound);
  const firstUserPickIndex = picks.findIndex((pick) => pick.ownerTeamAbbr === userTeamAbbr);
  const shouldUnlockRoundScroll =
    firstUserPickIndex >= 0 ? currentPickIndex >= firstUserPickIndex : false;
  const halfWindow = Math.floor(windowSize / 2);
  const roundStartIndex = picks.findIndex((pick) => pick.round === currentRound);
  const relativeCurrentIndex =
    roundStartIndex >= 0 ? Math.max(0, currentPickIndex - roundStartIndex) : 0;
  const windowStart = Math.max(0, relativeCurrentIndex - halfWindow);
  const windowEnd = Math.min(roundPicks.length, windowStart + windowSize);
  const visiblePicks = shouldUnlockRoundScroll
    ? roundPicks
    : roundPicks.slice(windowStart, windowEnd);
  const teamLookup = new Map(teams.map((team) => [team.abbr, team]));
  const userTeam = teamLookup.get(userTeamAbbr);
  const userTeamPrimaryColor = userTeam?.colors?.[0] ?? 'var(--team-primary)';
  const userTeamSecondaryColor = userTeam?.colors?.[1] ?? 'var(--team-secondary)';
  const userTeamOnPrimaryColor =
    userTeam?.colors?.[0] ? getReadableTextColor(userTeam.colors[0]) : 'var(--team-on-primary)';
  const userTeamOnSecondaryColor =
    userTeam?.colors?.[1] ? getReadableTextColor(userTeam.colors[1]) : 'var(--team-on-secondary)';

  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Draft Tracker
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">2026 NFL Draft</h2>
        </div>
        {controls ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {controls.canSkipToUserPick ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={controls.onSkipToUserPick}
                disabled={controls.isBusy}
              >
                Skip To My Pick
              </Button>
            ) : null}

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

            <Button
              type="button"
              size="sm"
              className="gap-2"
              onClick={controls.onOfferTrade}
              disabled={controls.isBusy || controls.canOfferTrade === false}
              style={{
                backgroundColor: userTeamSecondaryColor,
                color: userTeamOnSecondaryColor,
              }}
            >
              <ArrowLeftRight className="h-4 w-4" />
              Offer Trade
            </Button>

            {!controls.hasStarted ? (
              <Button
                type="button"
                size="sm"
                onClick={controls.onStartDraft}
                disabled={controls.isBusy}
                style={{
                  backgroundColor: userTeamPrimaryColor,
                  color: userTeamOnPrimaryColor,
                }}
              >
                Start Draft
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={controls.onTogglePause}
                disabled={controls.isBusy}
                style={
                  controls.isPaused
                    ? {
                        backgroundColor: userTeamPrimaryColor,
                        color: userTeamOnPrimaryColor,
                      }
                    : undefined
                }
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

      <div className={cn('mt-4 pb-1', shouldUnlockRoundScroll ? 'overflow-x-auto' : 'overflow-hidden')}>
        <div className="flex min-w-max gap-3">
          {visiblePicks.map((pick) => {
            const team = teamLookup.get(pick.ownerTeamAbbr);
            const primaryColor = team?.colors?.[0] ?? '#020617';
            const onPrimaryColor = getReadableTextColor(primaryColor);
            const draftedPlayer = pick.selectedPlayerId
              ? prospects.find((player) => player.id === pick.selectedPlayerId)
              : null;
            const isCurrent = pick.id === currentPick?.id;
            const isCompleted = Boolean(draftedPlayer);
            const isUser = pick.ownerTeamAbbr === userTeamAbbr;

            return (
              <div
                key={pick.id}
                className={cn(
                  'w-[176px] shrink-0 rounded-2xl border px-3 py-2 transition-all',
                  isCurrent
                    ? 'shadow-lg ring-2 ring-slate-200'
                    : 'border-border bg-slate-50 text-foreground',
                )}
                style={
                  isCurrent
                    ? {
                        backgroundColor: primaryColor,
                        borderColor: primaryColor,
                        color: onPrimaryColor,
                      }
                    : undefined
                }
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
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={
                      isCurrent
                        ? { backgroundColor: onPrimaryColor === '#ffffff' ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.12)' }
                        : { backgroundColor: 'rgba(255,255,255,0.7)' }
                    }
                  >
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
                          isCurrent ? '' : 'text-slate-600',
                        )}
                        style={isCurrent ? { color: onPrimaryColor } : undefined}
                      >
                        {pick.ownerTeamAbbr}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 min-h-[2rem]">
                  {draftedPlayer ? (
                    <div className="flex items-start gap-2">
                      <div className="shrink-0">
                        {draftedPlayer.headshotUrl ? (
                          <Image
                            src={draftedPlayer.headshotUrl}
                            alt={`${draftedPlayer.firstName} ${draftedPlayer.lastName}`}
                            width={28}
                            height={28}
                            className="h-7 w-7 rounded-full object-cover object-top"
                            unoptimized
                          />
                        ) : (
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold"
                            style={{
                              backgroundColor: isCurrent
                                ? onPrimaryColor === '#ffffff'
                                  ? 'rgba(255,255,255,0.14)'
                                  : 'rgba(15,23,42,0.12)'
                                : 'rgba(255,255,255,0.7)',
                              color: isCurrent ? onPrimaryColor : '#475569',
                            }}
                          >
                            {draftedPlayer.firstName.charAt(0)}
                            {draftedPlayer.lastName.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'line-clamp-1 text-sm font-semibold',
                            isCurrent ? '' : 'text-foreground',
                          )}
                          style={isCurrent ? { color: onPrimaryColor } : undefined}
                        >
                          {draftedPlayer.firstName} {draftedPlayer.lastName}
                        </p>
                        <p
                          className={cn(
                            'mt-0.5 text-[11px]',
                            isCurrent ? '' : 'text-muted-foreground',
                          )}
                          style={
                            isCurrent
                              ? {
                                  color:
                                    onPrimaryColor === '#ffffff'
                                      ? 'rgba(255,255,255,0.78)'
                                      : 'rgba(15,23,42,0.72)',
                                }
                              : undefined
                          }
                        >
                          {draftedPlayer.position}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p
                      className={cn(
                        'line-clamp-2 text-[11px] leading-4',
                        isCurrent ? '' : 'text-muted-foreground',
                      )}
                      style={isCurrent ? { color: onPrimaryColor === '#ffffff' ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.72)' } : undefined}
                    >
                      {team?.teamNeeds?.slice(0, 2).join(' · ') || 'Best player available'}
                    </p>
                  )}
                </div>

                {isUser ? (
                  <p
                    className={cn(
                      'mt-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                      isCurrent ? '' : 'text-slate-500',
                    )}
                    style={isCurrent ? { color: onPrimaryColor === '#ffffff' ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.64)' } : undefined}
                  >
                    Your pick
                  </p>
                ) : null}

                {isCompleted && draftedPlayer ? (
                  <div className="mt-2 flex justify-end">
                    <span
                      className="inline-flex min-w-[28px] items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{
                        backgroundColor: isCurrent
                          ? onPrimaryColor === '#ffffff'
                            ? 'rgba(255,255,255,0.14)'
                            : 'rgba(15,23,42,0.12)'
                          : '#e2e8f0',
                        color: isCurrent ? onPrimaryColor : '#0f172a',
                      }}
                    >
                      {getStoredPickGrade(pick) ?? 'B'}
                    </span>
                  </div>
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
