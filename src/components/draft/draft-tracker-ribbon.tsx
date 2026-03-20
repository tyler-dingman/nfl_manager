'use client';

import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DraftPickDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';
import type { TeamDTO } from '@/types/team';

type DraftTrackerRibbonProps = {
  picks: DraftPickDTO[];
  currentPickIndex: number;
  prospects: PlayerRowDTO[];
  teams: TeamDTO[];
  userTeamAbbr: string;
  windowSize?: number;
};

export function DraftTrackerRibbon({
  picks,
  currentPickIndex,
  prospects,
  teams,
  userTeamAbbr,
  windowSize = 7,
}: DraftTrackerRibbonProps) {
  const halfWindow = Math.floor(windowSize / 2);
  const startIndex = Math.max(0, currentPickIndex - halfWindow);
  const endIndex = Math.min(picks.length, startIndex + windowSize);
  const visiblePicks = picks.slice(startIndex, endIndex);
  const teamLookup = new Map(teams.map((team) => [team.abbr, team]));

  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Draft Tracker
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">Live Draft Window</h2>
        </div>
        <div className="text-xs text-muted-foreground">
          Picks {visiblePicks[0]?.overall ?? 1}-{visiblePicks[visiblePicks.length - 1]?.overall ?? visiblePicks.length}
        </div>
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
                  'w-[180px] shrink-0 rounded-2xl border px-4 py-3 transition-all',
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
                    <p className="mt-1 text-sm font-semibold">{team?.abbr ?? pick.ownerTeamAbbr}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                    {team?.logoUrl ? (
                      <Image
                        src={team.logoUrl}
                        alt={`${team?.name ?? pick.ownerTeamAbbr} logo`}
                        width={32}
                        height={32}
                        className="h-8 w-8 object-contain"
                        unoptimized
                      />
                    ) : (
                      <span className={cn('text-xs font-semibold', isCurrent ? 'text-white' : 'text-slate-600')}>
                        {pick.ownerTeamAbbr}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Badge
                    variant={isCompleted ? 'secondary' : isCurrent ? 'success' : 'outline'}
                    className={cn(isCurrent ? 'border-white/15 bg-white/10 text-white' : '')}
                  >
                    {isCompleted ? 'Pick Made' : isCurrent ? 'On the Clock' : 'Upcoming'}
                  </Badge>
                  {isUser ? <Badge variant="outline">User</Badge> : null}
                </div>

                <div className="mt-3 min-h-[2.75rem]">
                  {draftedPlayer ? (
                    <>
                      <p className={cn('text-sm font-semibold', isCurrent ? 'text-white' : 'text-foreground')}>
                        {draftedPlayer.firstName} {draftedPlayer.lastName}
                      </p>
                      <p className={cn('mt-1 text-xs', isCurrent ? 'text-slate-300' : 'text-muted-foreground')}>
                        {draftedPlayer.position}
                      </p>
                    </>
                  ) : (
                    <p className={cn('text-xs leading-5', isCurrent ? 'text-slate-300' : 'text-muted-foreground')}>
                      {team?.teamNeeds?.slice(0, 2).join(' · ') || 'Best player available'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
