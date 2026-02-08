'use client';

import * as React from 'react';

import { FalcoReactionFeed, type DraftEventDTO } from '@/components/draft/falco-reaction-feed';
import FalcoAlertToast from '@/components/falco-alert';
import FalcoTicker from '@/components/falco-ticker';
import { PlayerTable } from '@/components/player-table';
import { Badge } from '@/components/ui/badge';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import {
  fillFalcoTemplate,
  type FalcoAlertType,
  quotesByType,
} from '@/features/draft/falco-quotes';
import { getFalcoReaction, getPickLabel } from '@/lib/draft-reactions';
import { getTeamNeeds } from '@/components/draft/draft-utils';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';
import type { FalcoNote } from '@/lib/falco';

const SPEED_DELAYS = [1000, 500, 250] as const;

export type DraftSpeedLevel = 0 | 1 | 2;

type ActiveDraftRoomProps = {
  session: DraftSessionDTO;
  draftSessionId: string;
  teams: Array<{ abbr: string; name: string; logoUrl: string; colors: string[] }>;
  falcoNotes: FalcoNote[];
  speedLevel: DraftSpeedLevel;
  draftView: 'board' | 'trade';
  onBackToBoard: () => void;
  onDraftPlayer?: (player: PlayerRowDTO) => void;
  onSessionUpdate: (session: DraftSessionDTO) => void;
};

const formatName = (player: PlayerRowDTO) => `${player.firstName} ${player.lastName}`;

export function ActiveDraftRoom({
  session,
  draftSessionId,
  teams,
  falcoNotes,
  speedLevel,
  draftView,
  onBackToBoard,
  onDraftPlayer,
  onSessionUpdate,
}: ActiveDraftRoomProps) {
  const currentPick = session.picks[session.currentPickIndex];
  const onClock =
    currentPick?.ownerTeamAbbr === session.userTeamAbbr && !currentPick?.selectedPlayerId;
  const [draftFeed, setDraftFeed] = React.useState<DraftEventDTO[]>([]);
  const pushAlert = useFalcoAlertStore((state) => state.pushAlert);
  const falcoHistory = useFalcoAlertStore((state) => state.history);
  const advanceInFlight = React.useRef(false);
  const skipInFlight = React.useRef(false);
  const timerRef = React.useRef<number | null>(null);
  const pickInProgressRef = React.useRef(false);
  const sessionRef = React.useRef(session);
  const previousPickSelections = React.useRef<Map<string, string | null>>(new Map());
  const firedFreeFallRef = React.useRef(false);
  const lastRunRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  React.useEffect(() => {
    firedFreeFallRef.current = false;
    lastRunRef.current = null;
  }, [session.id]);

  const bestAvailable = React.useMemo(() => {
    return session.prospects
      .filter((player) => !player.isDrafted)
      .slice()
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  }, [session.prospects]);

  const teamLookup = React.useMemo(() => {
    const map = new Map(teams.map((team) => [team.abbr, team]));
    return map;
  }, [teams]);

  const falcoTagsByPlayer = React.useMemo(() => {
    const map = new Map<string, string[]>();
    falcoNotes.forEach((note) => {
      const list = map.get(note.playerId) ?? [];
      list.push(note.tag);
      map.set(note.playerId, list);
    });
    return map;
  }, [falcoNotes]);

  const buildAlertMessage = React.useCallback(
    (type: FalcoAlertType, data: Record<string, string | number | undefined>) => {
      const options = quotesByType[type];
      const choice = options[Math.floor(Math.random() * options.length)] ?? options[0];
      return fillFalcoTemplate(choice, data);
    },
    [],
  );

  const falcoFavorites = React.useMemo(() => {
    if (!onClock || !currentPick) {
      return [];
    }
    const needs = getTeamNeeds(session.userTeamAbbr);
    const pickNumber = currentPick.overall;
    return bestAvailable
      .map((player) => {
        const rank = player.rank ?? 999;
        const tags = falcoTagsByPlayer.get(player.id) ?? [];
        let score = 200 - rank;
        score += Math.max(0, pickNumber - rank) * 2;
        if (needs.includes(player.position)) score += 25;
        if (tags.includes('Falco Favorite')) score += 20;
        if (tags.includes('Falco Rising')) score += 10;
        if (tags.includes('Falco Fading')) score -= 8;
        return { player, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.player);
  }, [bestAvailable, currentPick, falcoTagsByPlayer, onClock, session.userTeamAbbr]);

  const advanceCpuPick = React.useCallback(async () => {
    if (advanceInFlight.current || skipInFlight.current) {
      return;
    }
    advanceInFlight.current = true;
    try {
      const response = await apiFetch('/api/draft/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftSessionId }),
      });
      const text = await response.text();
      if (!text) {
        console.warn('Draft advance: empty response');
        return;
      }
      const payload = JSON.parse(text) as
        | { ok: true; session: DraftSessionDTO }
        | { ok: false; error: string };
      if (!response.ok || !payload.ok) {
        console.warn('Draft advance failed:', payload.ok ? response.status : payload.error);
        return;
      }
      onSessionUpdate(payload.session);
    } catch (error) {
      console.error('Draft advance error:', error);
    } finally {
      advanceInFlight.current = false;
    }
  }, [draftSessionId, onSessionUpdate]);

  const handleSkipToUserPick = React.useCallback(async () => {
    if (onClock || skipInFlight.current) {
      return;
    }
    skipInFlight.current = true;
    try {
      let safety = 0;
      let snapshot = session;
      while (safety < 64) {
        const current = snapshot.picks[snapshot.currentPickIndex];
        if (!current || current.ownerTeamAbbr === snapshot.userTeamAbbr) {
          onSessionUpdate(snapshot);
          break;
        }
        const response = await apiFetch('/api/draft/advance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftSessionId }),
        });
        const text = await response.text();
        if (!text) {
          break;
        }
        const payload = JSON.parse(text) as
          | { ok: true; session: DraftSessionDTO }
          | { ok: false; error: string };
        if (!response.ok || !payload.ok) {
          break;
        }
        snapshot = payload.session;
        onSessionUpdate(snapshot);
        safety += 1;
      }
    } finally {
      skipInFlight.current = false;
    }
  }, [draftSessionId, onClock, onSessionUpdate, session]);

  const clearDraftTimer = React.useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleNextCpuPick = React.useCallback(() => {
    clearDraftTimer();
    const delay = SPEED_DELAYS[speedLevel] ?? 1000;
    timerRef.current = window.setTimeout(async () => {
      const currentSession = sessionRef.current;
      const current = currentSession.picks[currentSession.currentPickIndex];
      const userOnClock =
        current?.ownerTeamAbbr === currentSession.userTeamAbbr && !current?.selectedPlayerId;
      if (currentSession.status !== 'in_progress' || currentSession.isPaused || userOnClock) {
        return;
      }
      if (pickInProgressRef.current) {
        scheduleNextCpuPick();
        return;
      }
      pickInProgressRef.current = true;
      await advanceCpuPick();
      pickInProgressRef.current = false;
      scheduleNextCpuPick();
    }, delay);
  }, [advanceCpuPick, clearDraftTimer, speedLevel]);

  React.useEffect(() => {
    const current = session.picks[session.currentPickIndex];
    const userOnClock =
      current?.ownerTeamAbbr === session.userTeamAbbr && !current?.selectedPlayerId;
    if (session.status !== 'in_progress' || session.isPaused || userOnClock) {
      clearDraftTimer();
      return;
    }
    scheduleNextCpuPick();
    return () => clearDraftTimer();
  }, [
    clearDraftTimer,
    scheduleNextCpuPick,
    session.currentPickIndex,
    session.isPaused,
    session.picks,
    session.status,
    session.userTeamAbbr,
    speedLevel,
  ]);

  React.useEffect(() => {
    const newEvents: DraftEventDTO[] = [];
    session.picks.forEach((pick) => {
      const previous = previousPickSelections.current.get(pick.id) ?? null;
      if (pick.selectedPlayerId && pick.selectedPlayerId !== previous) {
        const player = session.prospects.find((prospect) => prospect.id === pick.selectedPlayerId);
        if (!player) {
          return;
        }
        const tags = (falcoTagsByPlayer.get(player.id) ?? []) as FalcoNote['tag'][];
        const label = getPickLabel({
          pickIndex: pick.overall,
          playerRank: player.rank ?? 999,
          teamNeeds: getTeamNeeds(pick.ownerTeamAbbr),
          playerPosition: player.position,
          tags,
        });
        newEvents.push({
          id: `event-${pick.id}-${pick.selectedPlayerId}`,
          playerId: player.id,
          pickNumber: pick.overall,
          teamAbbr: pick.ownerTeamAbbr,
          teamLogoUrl: teamLookup.get(pick.ownerTeamAbbr)?.logoUrl,
          playerName: formatName(player),
          position: player.position,
          label,
          reaction: getFalcoReaction({
            label,
            teamAbbr: pick.ownerTeamAbbr,
            playerName: formatName(player),
            position: player.position,
            pickNumber: pick.overall,
          }),
          createdAt: new Date().toISOString(),
        });
      }
      previousPickSelections.current.set(pick.id, pick.selectedPlayerId ?? null);
    });
    if (newEvents.length > 0) {
      setDraftFeed((prev) => [...newEvents.reverse(), ...prev].slice(0, 50));
      newEvents.forEach((event) => {
        const player = session.prospects.find((prospect) => prospect.id === event.playerId);
        if (!player) return;
        const projected = player.projectedPick ?? player.rank ?? event.pickNumber;
        const delta = event.pickNumber - projected;
        if (delta <= -10) {
          const message = buildAlertMessage('RISKY_REACH', {
            PLAYER: event.playerName,
            TEAM: event.teamAbbr,
            PICK: event.pickNumber,
            PROJECTED: projected,
          });
          pushAlert({
            id: `reach-${event.playerId}`,
            type: 'RISKY_REACH',
            message,
            createdAt: new Date().toISOString(),
          });
        }
        if (event.teamAbbr === session.userTeamAbbr && delta >= 10) {
          const message = buildAlertMessage('VALUE_STEAL', {
            PLAYER: event.playerName,
            PICK: event.pickNumber,
            PROJECTED: projected,
          });
          pushAlert({
            id: `value-${event.playerId}`,
            type: 'VALUE_STEAL',
            message,
            createdAt: new Date().toISOString(),
          });
        }
      });
    }
  }, [
    buildAlertMessage,
    falcoTagsByPlayer,
    pushAlert,
    session.picks,
    session.prospects,
    session.userTeamAbbr,
    teamLookup,
  ]);

  React.useEffect(() => {
    const fallingId = session.fallingProspectId;
    if (!fallingId || firedFreeFallRef.current) return;
    const player = session.prospects.find((prospect) => prospect.id === fallingId);
    if (!player || player.isDrafted) return;
    const projected = player.projectedPick ?? player.rank ?? 0;
    if (session.currentPickIndex + 1 >= projected + 10) {
      firedFreeFallRef.current = true;
      const lines = [
        "He's slipping.",
        "Something's spooked teams. Could be noise. Could be real.",
        'Trust your read.',
      ];
      pushAlert({
        id: `freefall-${player.id}`,
        type: 'FREE_FALL',
        title: `${player.firstName} ${player.lastName}`,
        message: lines[0],
        lines,
        createdAt: new Date().toISOString(),
      });
    }
  }, [
    buildAlertMessage,
    pushAlert,
    session.currentPickIndex,
    session.fallReason,
    session.fallingProspectId,
    session.prospects,
  ]);

  React.useEffect(() => {
    const drafted = session.picks
      .filter((pick) => pick.selectedPlayerId)
      .slice(-5)
      .map((pick) => session.prospects.find((player) => player.id === pick.selectedPlayerId))
      .filter(Boolean);
    if (drafted.length < 3) return;
    const counts = drafted.reduce<Record<string, number>>((acc, player) => {
      const pos = player?.position ?? 'UNK';
      acc[pos] = (acc[pos] ?? 0) + 1;
      return acc;
    }, {});
    const runEntry = Object.entries(counts).find(([, count]) => count >= 3);
    if (!runEntry) return;
    const [position] = runEntry;
    if (lastRunRef.current === position) return;
    lastRunRef.current = position;
    const message = buildAlertMessage('POSITION_RUN', { POSITION: position });
    pushAlert({
      id: `run-${position}-${session.currentPickIndex}`,
      type: 'POSITION_RUN',
      message,
      createdAt: new Date().toISOString(),
    });
  }, [buildAlertMessage, pushAlert, session.currentPickIndex, session.picks, session.prospects]);

  // Trade UI removed per draft screen simplification.

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm lg:w-[340px] lg:max-w-[340px] lg:min-w-[340px]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Draft Board</h2>
          <span className="text-xs text-muted-foreground">
            Pick {session.currentPickIndex + 1} of {session.picks.length}
          </span>
        </div>
        <div className="mt-4 space-y-3 overflow-y-auto pr-2">
          {session.picks.map((pick, index) => {
            const isCurrent = index === session.currentPickIndex;
            const isNext = index === session.currentPickIndex + 1;
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
                    ? `${pick.ownerTeamAbbr} drafted ${formatName(selectedPlayer)} (${selectedPlayer.position})`
                    : isCurrent
                      ? 'On the clock'
                      : isNext
                        ? 'On deck'
                        : 'Waiting'}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          {draftView === 'trade' ? (
            <div className="rounded-xl border border-border bg-slate-50 px-6 py-8 text-center">
              <h3 className="text-lg font-semibold text-foreground">Propose Trade</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Trade logic coming next. This screen will let you offer picks and players.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex items-center justify-center rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-sm"
                onClick={onBackToBoard}
              >
                Back to Draft Board
              </button>
            </div>
          ) : (
            <>
              {onClock && falcoFavorites.length > 0 ? (
                <div className="mb-4 rounded-xl border border-border bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Falco Favorites
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {falcoFavorites.map((player) => (
                      <div
                        key={player.id}
                        className="rounded-lg border border-border bg-white px-3 py-2"
                      >
                        <p className="text-sm font-semibold text-foreground">
                          {formatName(player)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {player.position} · Rank {player.rank ?? '--'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <PlayerTable
                data={bestAvailable}
                variant="draft"
                onDraftPlayer={onClock ? onDraftPlayer : undefined}
                onTheClockForUserTeam={onClock}
              />
              {!onClock && bestAvailable.length > 0 && (
                <div className="mt-4 rounded-xl border border-border bg-blue-50 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Waiting for your pick...</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    CPU teams are picking. Your team will be on the clock soon.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        <FalcoReactionFeed events={draftFeed} />
        <FalcoTicker alerts={falcoHistory} />
      </section>
      <FalcoAlertToast />
    </div>
  );
}
