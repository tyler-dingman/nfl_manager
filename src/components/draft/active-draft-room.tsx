'use client';

import * as React from 'react';

import { PlayerTable } from '@/components/player-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';

const SPEED_LABELS = ['Slow', 'Fast', 'Turbo'] as const;

export type DraftSpeedLevel = 0 | 1 | 2;

type ActiveDraftRoomProps = {
  session: DraftSessionDTO;
  speedLevel: DraftSpeedLevel;
  onSpeedChange: (level: DraftSpeedLevel) => void;
  onTogglePause: () => void;
  onDraftPlayer?: (player: PlayerRowDTO) => void;
};

const formatName = (player: PlayerRowDTO) => `${player.firstName} ${player.lastName}`;

export function ActiveDraftRoom({
  session,
  speedLevel,
  onSpeedChange,
  onTogglePause,
  onDraftPlayer,
}: ActiveDraftRoomProps) {
  const currentPick = session.picks[session.currentPickIndex];
  const onClock = currentPick?.ownerTeamAbbr === session.userTeamAbbr;
  const speedLabel = SPEED_LABELS[speedLevel] ?? SPEED_LABELS[1];
  const [activeTab, setActiveTab] = React.useState<'draft' | 'waiting'>(
    onClock ? 'draft' : 'waiting',
  );

  const bestAvailable = React.useMemo(() => {
    return session.prospects
      .filter((player) => !player.isDrafted)
      .slice()
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  }, [session.prospects]);

  React.useEffect(() => {
    setActiveTab(onClock ? 'draft' : 'waiting');
  }, [onClock]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Draft Board</h2>
          <span className="text-xs text-muted-foreground">
            Pick {session.currentPickIndex + 1} of {session.picks.length}
          </span>
        </div>
        <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-2">
          {session.picks.map((pick, index) => {
            const isCurrent = index === session.currentPickIndex;
            const selectedPlayer = pick.selectedPlayerId
              ? session.prospects.find((player) => player.id === pick.selectedPlayerId)
              : null;
            return (
              <div
                key={pick.id}
                className={cn(
                  'rounded-xl border border-border px-3 py-2 text-sm',
                  isCurrent && 'border-primary/40 bg-primary/5',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    #{pick.overall} · {pick.ownerTeamAbbr}
                  </span>
                  {pick.ownerTeamAbbr === session.userTeamAbbr && (
                    <Badge variant="secondary">User</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedPlayer
                    ? `${formatName(selectedPlayer)} (${selectedPlayer.position})`
                    : 'On deck'}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                On the Clock
              </p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">
                {currentPick
                  ? `Pick ${currentPick.overall} — ${currentPick.ownerTeamAbbr}`
                  : 'Awaiting pick'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Round {currentPick?.round ?? 1} · {onClock ? 'User pick' : 'CPU pick'}
              </p>
            </div>
            <Badge variant={onClock ? 'success' : session.isPaused ? 'outline' : 'secondary'}>
              {onClock ? 'On the clock' : session.isPaused ? 'Paused' : 'Running'}
            </Badge>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Button type="button" variant="outline" onClick={onTogglePause}>
              {session.isPaused ? 'Resume Draft' : 'Pause Draft'}
            </Button>
            <div className="min-w-[220px]">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Speed</span>
                <span>{speedLabel}</span>
              </div>
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={2}
                step={1}
                value={speedLevel}
                onChange={(event) => onSpeedChange(Number(event.target.value) as DraftSpeedLevel)}
              />
              <div className="mt-1 flex justify-between text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
                {SPEED_LABELS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={activeTab === 'draft' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-full px-4"
                onClick={() => setActiveTab('draft')}
                disabled={!onClock}
              >
                Draft a Player
              </Button>
              <Button
                type="button"
                variant={activeTab === 'waiting' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-full px-4"
                onClick={() => setActiveTab('waiting')}
                disabled={onClock}
              >
                Waiting
              </Button>
            </div>
            {currentPick ? (
              <span className="text-xs text-muted-foreground">
                Pick {currentPick.overall} · {currentPick.ownerTeamAbbr}
              </span>
            ) : null}
          </div>

          {activeTab === 'draft' ? (
            <div className="mt-4">
              <PlayerTable
                data={bestAvailable}
                variant="draft"
                onDraftPlayer={onClock ? onDraftPlayer : undefined}
                onTheClockForUserTeam={onClock}
              />
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-border bg-slate-50 px-4 py-6 text-center">
              <p className="text-sm font-semibold text-foreground">Waiting for your pick...</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Draft buttons are disabled until your team is on the clock.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
