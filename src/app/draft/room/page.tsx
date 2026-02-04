'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

import AppShell from '@/components/app-shell';
import { PlayerTable } from '@/components/player-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getDraftGrade, getPickValue, getTradeAcceptance } from '@/lib/draft-utils';
import type { DraftSessionDTO, DraftMode, DraftPickDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';

const PARTNER_TEAM = 'DAL';

type DraftSessionStartResponse = {
  draftSessionId: string;
  rng_seed: number;
};

const formatName = (player: PlayerRowDTO) =>
  `${player.firstName} ${player.lastName}`;

const getPickLabel = (pick: DraftPickDTO) =>
  `Pick ${pick.overall} · ${pick.ownerTeamAbbr}`;

export default function DraftRoomPage() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');
  const mode: DraftMode = modeParam === 'real' ? 'real' : 'mock';
  const [session, setSession] = React.useState<DraftSessionDTO | null>(null);
  const [draftSessionId, setDraftSessionId] = React.useState<string>('');
  const [saveId, setSaveId] = React.useState<string>('');
  const [error, setError] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [sendPickIds, setSendPickIds] = React.useState<string[]>([]);
  const [receivePickIds, setReceivePickIds] = React.useState<string[]>([]);
  const hasStartedRef = React.useRef(false);

  const fetchSession = React.useCallback(async (id: string) => {
    const response = await fetch(`/api/draft/session?draftSessionId=${id}`);
    if (!response.ok) {
      throw new Error('Unable to load draft session');
    }
    const data = (await response.json()) as DraftSessionDTO;
    setSession(data);
  }, []);

  React.useEffect(() => {
    const startSession = async () => {
      try {
        setLoading(true);
        let activeSaveId = saveId;
        if (mode === 'real' && !activeSaveId) {
          const saveResponse = await fetch('/api/saves', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamAbbr: 'GB' }),
          });

          if (!saveResponse.ok) {
            throw new Error('Unable to create save');
          }

          const saveData = (await saveResponse.json()) as { id: string };
          activeSaveId = saveData.id;
          setSaveId(activeSaveId);
        }

        const response = await fetch('/api/draft/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, saveId: activeSaveId || undefined }),
        });

        if (!response.ok) {
          throw new Error('Unable to start draft session');
        }

        const data = (await response.json()) as DraftSessionStartResponse;
        setDraftSessionId(data.draftSessionId);
        await fetchSession(data.draftSessionId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Draft session error');
      } finally {
        setLoading(false);
      }
    };

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      startSession();
    }
  }, [fetchSession, mode, saveId]);

  const handleDraftPlayer = async (player: PlayerRowDTO) => {
    if (!draftSessionId) {
      return;
    }

    const response = await fetch('/api/draft/session/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftSessionId, playerId: player.id }),
    });

    if (response.ok) {
      const data = (await response.json()) as DraftSessionDTO;
      setSession(data);
    }
  };

  const togglePick = (
    pickId: string,
    setSelected: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setSelected((prev) =>
      prev.includes(pickId) ? prev.filter((id) => id !== pickId) : [...prev, pickId],
    );
  };

  const handleTrade = async () => {
    if (!draftSessionId) {
      return;
    }

    const response = await fetch('/api/draft/session/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftSessionId,
        partnerTeamAbbr: PARTNER_TEAM,
        sendPickIds,
        receivePickIds,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as DraftSessionDTO;
      setSession(data);
      setSendPickIds([]);
      setReceivePickIds([]);
    }
  };

  const currentPick = session?.picks[session.currentPickIndex];
  const onClock =
    session?.status === 'in_progress' &&
    currentPick?.ownerTeamAbbr === session?.userTeamAbbr;

  const availablePicks = (teamAbbr: string) =>
    session?.picks.filter(
      (pick) =>
        pick.ownerTeamAbbr === teamAbbr &&
        !pick.selectedPlayerId &&
        pick.overall > (session?.currentPickIndex ?? 0) + 1,
    ) ?? [];

  const sendValue = sendPickIds
    .map((id) => session?.picks.find((pick) => pick.id === id))
    .filter((pick): pick is DraftPickDTO => Boolean(pick))
    .reduce((total, pick) => total + getPickValue(pick.overall), 0);

  const receiveValue = receivePickIds
    .map((id) => session?.picks.find((pick) => pick.id === id))
    .filter((pick): pick is DraftPickDTO => Boolean(pick))
    .reduce((total, pick) => total + getPickValue(pick.overall), 0);

  const acceptance = getTradeAcceptance(sendValue, receiveValue);
  const tradeAllowed = mode === 'mock' && acceptance >= 50;

  const userTeamAbbr = session?.userTeamAbbr ?? '';
  const prospects = session?.prospects ?? [];
  const userSelections = session?.picks
    .filter(
      (pick) => pick.selectedByTeamAbbr === userTeamAbbr && pick.selectedPlayerId,
    )
    .map((pick) =>
      prospects.find((player) => player.id === pick.selectedPlayerId),
    )
    .filter((player): player is PlayerRowDTO => Boolean(player));

  const draftGrade = getDraftGrade(
    (userSelections ?? []).map((player) => player.rank ?? 100),
  );

  if (loading) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Loading draft room...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !session) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm text-destructive">{error || 'Draft not available'}</p>
        </div>
      </AppShell>
    );
  }

  if (session.status === 'completed') {
    return (
      <AppShell>
        <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Draft Complete
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === 'real'
                  ? 'Draft results saved to your roster.'
                  : 'Mock draft finalized.'}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-slate-50 px-6 py-4 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Draft Grade
              </p>
              <p className="mt-2 text-3xl font-bold text-foreground">{draftGrade}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {(userSelections ?? []).map((player) => (
              <div
                key={player.id}
                className="rounded-xl border border-border bg-white px-4 py-3 shadow-sm"
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
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Draft Room</h1>
          <p className="text-sm text-muted-foreground">
            Mode: {mode === 'real' ? 'Real Draft' : 'Mock Draft'} · RNG seed{' '}
            {session.rngSeed}
          </p>
        </div>
        <Badge variant={onClock ? 'success' : 'outline'}>
          {onClock ? 'Your pick' : 'CPU running'}
        </Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_2fr_1fr]">
        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Draft Order</h2>
          <div className="mt-4 space-y-3">
            {session.picks.map((pick, index) => {
              const isCurrent = index === session.currentPickIndex;
              const selectedPlayer = pick.selectedPlayerId
                ? session.prospects.find(
                    (player) => player.id === pick.selectedPlayerId,
                  )
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
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Prospect Board
                </h2>
                <p className="text-sm text-muted-foreground">
                  Top prospects remain available in the center board.
                </p>
              </div>
              {currentPick && (
                <div className="rounded-xl border border-border bg-slate-50 px-4 py-3 text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    On the clock
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {currentPick.ownerTeamAbbr} · Pick {currentPick.overall}
                  </p>
                </div>
              )}
            </div>
          </div>
          <PlayerTable
            data={session.prospects}
            variant="draftProspects"
            onDraftPlayer={handleDraftPlayer}
            onTheClockForUserTeam={onClock}
          />
        </section>

        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Trade Center</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Build a picks-only deal with {PARTNER_TEAM}.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                You send
              </p>
              <div className="mt-2 space-y-2">
                {availablePicks(session.userTeamAbbr).map((pick) => (
                  <button
                    key={pick.id}
                    type="button"
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-left text-sm transition',
                      sendPickIds.includes(pick.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-slate-50',
                    )}
                    onClick={() => togglePick(pick.id, setSendPickIds)}
                  >
                    {getPickLabel(pick)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      Value {getPickValue(pick.overall)}
                    </span>
                  </button>
                ))}
                {availablePicks(session.userTeamAbbr).length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No tradable picks.
                  </p>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                You receive
              </p>
              <div className="mt-2 space-y-2">
                {availablePicks(PARTNER_TEAM).map((pick) => (
                  <button
                    key={pick.id}
                    type="button"
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-left text-sm transition',
                      receivePickIds.includes(pick.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-slate-50',
                    )}
                    onClick={() => togglePick(pick.id, setReceivePickIds)}
                  >
                    {getPickLabel(pick)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      Value {getPickValue(pick.overall)}
                    </span>
                  </button>
                ))}
                {availablePicks(PARTNER_TEAM).length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No tradable picks.
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Acceptance meter</span>
                <span>{acceptance}%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                <div
                  className={cn(
                    'h-2 rounded-full',
                    acceptance >= 50 ? 'bg-emerald-500' : 'bg-amber-500',
                  )}
                  style={{ width: `${acceptance}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Send value: {sendValue}</span>
                <span>Receive value: {receiveValue}</span>
              </div>
            </div>
            <Button type="button" onClick={handleTrade} disabled={!tradeAllowed}>
              {mode === 'mock' ? 'Propose trade' : 'Trades disabled in real mode'}
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
