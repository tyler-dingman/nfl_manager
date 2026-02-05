'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import AppShell from '@/components/app-shell';
import { PlayerTable } from '@/components/player-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSaveStore } from '@/features/save/save-store';
import { cn } from '@/lib/utils';
import { getDraftGrade, getPickValue, getTradeAcceptance } from '@/lib/draft-utils';
import type { DraftMode, DraftPickDTO, DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';

export const dynamic = 'force-dynamic';

const SPEED_OPTIONS = ['manual', 'slow', 'normal', 'fast'] as const;

type DraftSpeed = (typeof SPEED_OPTIONS)[number];

type DraftTab = 'draft' | 'trade' | 'analysis';

type DraftSessionResponse = { ok: true; session: DraftSessionDTO } | { ok: false; error: string };

type DraftPickResponse = { ok: true; session: DraftSessionDTO } | { ok: false; error: string };

type DraftSessionStartResponse = DraftSessionResponse;

type ActiveDraftSessionResponse =
  | { ok: true; session: DraftSessionDTO | null }
  | { ok: false; error: string };

type DraftGradeResult = {
  grade: string;
  headline: string;
  detail: string;
};

const formatName = (player: PlayerRowDTO) => `${player.firstName} ${player.lastName}`;

const getPickLabel = (pick: DraftPickDTO) => `Pick ${pick.overall} · ${pick.ownerTeamAbbr}`;

const getSpeedDelay = (speed: DraftSpeed) => {
  switch (speed) {
    case 'fast':
      return 350;
    case 'slow':
      return 1400;
    case 'manual':
      return 0;
    default:
      return 800;
  }
};

const getDraftGradeResult = (
  pick: DraftPickDTO,
  player: PlayerRowDTO,
  prospects: PlayerRowDTO[],
): DraftGradeResult => {
  const rank = player.rank ?? pick.overall;
  const valueDelta = pick.overall - rank;
  const remaining = prospects.filter((prospect) => !prospect.isDrafted);
  const scarcity = remaining.reduce<Record<string, number>>((acc, prospect) => {
    acc[prospect.position] = (acc[prospect.position] ?? 0) + 1;
    return acc;
  }, {});

  const needs = Object.entries(scarcity)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([position]) => position);

  const needsBonus = needs.includes(player.position) ? 4 : 0;
  const score = valueDelta + needsBonus;

  const grade = score >= 12 ? 'A' : score >= 5 ? 'B' : score >= -3 ? 'C' : score >= -10 ? 'D' : 'F';

  const headline = `${grade} grade on ${formatName(player)}`;
  const detail = `Selected at #${pick.overall} (rank ${rank}). ${
    needsBonus ? 'Position scarcity bonus.' : 'Value-driven grade.'
  }`;

  return { grade, headline, detail };
};

function DraftGradeModal({
  isOpen,
  onClose,
  result,
}: {
  isOpen: boolean;
  onClose: () => void;
  result: DraftGradeResult | null;
}) {
  if (!isOpen || !result) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Draft Grade</h3>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-slate-50 p-4 text-center">
          <p className="text-4xl font-bold text-foreground">{result.grade}</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{result.headline}</p>
          <p className="mt-2 text-xs text-muted-foreground">{result.detail}</p>
        </div>
        <Button type="button" className="mt-4 w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

function DraftRoomContent() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');
  const mode: DraftMode = modeParam === 'real' ? 'real' : 'mock';
  const [session, setSession] = React.useState<DraftSessionDTO | null>(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<DraftTab>('draft');
  const [speed, setSpeed] = React.useState<DraftSpeed>('normal');
  const [gradeResult, setGradeResult] = React.useState<DraftGradeResult | null>(null);
  const [isGradeOpen, setIsGradeOpen] = React.useState(false);
  const [sendPickIds, setSendPickIds] = React.useState<string[]>([]);
  const [receivePickIds, setReceivePickIds] = React.useState<string[]>([]);
  const [partnerTeamAbbr, setPartnerTeamAbbr] = React.useState<string>('');

  const saveId = useSaveStore((state) => state.saveId);
  const activeDraftSessionId = useSaveStore((state) => state.activeDraftSessionId);
  const setActiveDraftSessionId = useSaveStore((state) => state.setActiveDraftSessionId);
  const refreshSaveHeader = useSaveStore((state) => state.refreshSaveHeader);

  const currentPick = session?.picks[session.currentPickIndex];
  const onClock =
    session?.status === 'in_progress' && currentPick?.ownerTeamAbbr === session?.userTeamAbbr;

  const userSelections = React.useMemo(() => {
    if (!session) {
      return [];
    }
    return session.picks
      .filter((pick) => pick.selectedByTeamAbbr === session.userTeamAbbr && pick.selectedPlayerId)
      .map((pick) => session.prospects.find((player) => player.id === pick.selectedPlayerId))
      .filter((player): player is PlayerRowDTO => Boolean(player));
  }, [session]);

  const availableTeams = React.useMemo(() => {
    if (!session) {
      return [];
    }
    const set = new Set(session.picks.map((pick) => pick.ownerTeamAbbr));
    return Array.from(set).sort();
  }, [session]);

  React.useEffect(() => {
    if (!partnerTeamAbbr && session) {
      const defaultPartner = availableTeams.find((abbr) => abbr !== session.userTeamAbbr);
      if (defaultPartner) {
        setPartnerTeamAbbr(defaultPartner);
      }
    }
  }, [availableTeams, partnerTeamAbbr, session]);

  const fetchSession = React.useCallback(
    async (draftSessionId: string) => {
      if (!saveId) {
        setError('Select a team to start a save.');
        return;
      }
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ draftSessionId, saveId });
      const response = await fetch(`/api/draft/session?${query.toString()}`);
      const payload = (await response.json()) as DraftSessionResponse;
      if (!response.ok || !payload.ok) {
        const message = payload.ok ? 'Unable to load draft session' : payload.error;
        if (message === 'Draft session not found') {
          setActiveDraftSessionId(null, saveId);
          setSession(null);
        }
        setError(message);
      } else {
        setSession(payload.session);
      }
      setLoading(false);
    },
    [saveId, setActiveDraftSessionId],
  );

  const startDraft = React.useCallback(async () => {
    if (!saveId) {
      setError('Select a team to start a save.');
      return;
    }
    setLoading(true);
    setError('');
    const response = await fetch('/api/draft/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId, mode }),
    });
    const payload = (await response.json()) as DraftSessionStartResponse;
    if (!response.ok || !payload.ok) {
      setError(payload.ok ? 'Unable to start draft session' : payload.error);
      setLoading(false);
      return;
    }
    setActiveDraftSessionId(payload.session.id, saveId);
    setSession(payload.session);
    setLoading(false);
  }, [mode, saveId, setActiveDraftSessionId]);

  const setPaused = React.useCallback(
    async (isPaused: boolean) => {
      if (!saveId || !activeDraftSessionId) {
        return;
      }
      const response = await fetch('/api/draft/session/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saveId, draftSessionId: activeDraftSessionId, isPaused }),
      });
      const payload = (await response.json()) as DraftSessionResponse;
      if (!response.ok || !payload.ok) {
        setError(payload.ok ? 'Unable to update pause state' : payload.error);
        return;
      }
      setSession(payload.session);
    },
    [activeDraftSessionId, saveId],
  );

  const advanceCpuPick = React.useCallback(async () => {
    if (!saveId || !activeDraftSessionId) {
      return;
    }
    const response = await fetch('/api/draft/session/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId, draftSessionId: activeDraftSessionId }),
    });
    const payload = (await response.json()) as DraftSessionResponse;
    if (!response.ok || !payload.ok) {
      setError(payload.ok ? 'Unable to advance draft' : payload.error);
      return;
    }
    setSession(payload.session);
  }, [activeDraftSessionId, saveId]);

  React.useEffect(() => {
    if (activeDraftSessionId) {
      void fetchSession(activeDraftSessionId);
    }
  }, [activeDraftSessionId, fetchSession]);

  React.useEffect(() => {
    if (!saveId || activeDraftSessionId) {
      return;
    }

    const restoreActiveSession = async () => {
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ saveId });
      const response = await fetch(`/api/draft/session/active?${query.toString()}`);
      const payload = (await response.json()) as ActiveDraftSessionResponse;
      if (!response.ok || !payload.ok) {
        setLoading(false);
        setError(payload.ok ? 'Unable to load draft session' : payload.error);
        return;
      }

      setSession(payload.session);
      setActiveDraftSessionId(payload.session?.id ?? null, saveId);
      setLoading(false);
    };

    void restoreActiveSession();
  }, [activeDraftSessionId, saveId, setActiveDraftSessionId]);

  React.useEffect(() => {
    if (!session || session.status !== 'in_progress') {
      return undefined;
    }
    if (session.isPaused || speed === 'manual' || onClock) {
      return undefined;
    }

    const delay = getSpeedDelay(speed);
    const timer = window.setTimeout(() => {
      void advanceCpuPick();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [advanceCpuPick, onClock, session, speed]);

  const handleDraftPlayer = async (player: PlayerRowDTO) => {
    if (!saveId || !activeDraftSessionId || !session) {
      return;
    }

    const response = await fetch('/api/draft/session/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId, draftSessionId: activeDraftSessionId, playerId: player.id }),
    });
    const payload = (await response.json()) as DraftPickResponse;
    if (!response.ok || !payload.ok) {
      setError(payload.ok ? 'Unable to make pick.' : payload.error);
      return;
    }
    setSession(payload.session);
    await refreshSaveHeader();

    if (currentPick && session.userTeamAbbr === currentPick.ownerTeamAbbr) {
      const result = getDraftGradeResult(currentPick, player, session.prospects);
      setGradeResult(result);
      setIsGradeOpen(true);
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
    if (!saveId || !activeDraftSessionId || !partnerTeamAbbr) {
      return;
    }

    const response = await fetch('/api/draft/session/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId,
        draftSessionId: activeDraftSessionId,
        partnerTeamAbbr,
        sendPickIds,
        receivePickIds,
      }),
    });

    const payload = (await response.json()) as DraftSessionResponse;
    if (!response.ok || !payload.ok) {
      setError(payload.ok ? 'Unable to apply trade.' : payload.error);
      return;
    }
    setSession(payload.session);
    setSendPickIds([]);
    setReceivePickIds([]);
  };

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

  if (!saveId) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Select a team to start a save.</p>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Loading draft room...</p>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm text-destructive">{error}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {activeDraftSessionId ? (
              <Button type="button" onClick={() => void fetchSession(activeDraftSessionId)}>
                Retry
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={startDraft}>
              Start Draft
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <DraftGradeModal
        isOpen={isGradeOpen}
        onClose={() => setIsGradeOpen(false)}
        result={gradeResult}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Draft Room</h1>
          <p className="text-sm text-muted-foreground">
            Mode: {mode === 'real' ? 'Real Draft' : 'Mock Draft'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {session ? (
            <Badge variant={onClock ? 'success' : session.isPaused ? 'outline' : 'secondary'}>
              {onClock ? 'On the clock' : session.isPaused ? 'Paused' : 'CPU running'}
            </Badge>
          ) : null}
          {!session ? (
            <Button type="button" onClick={startDraft}>
              Start Draft
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => void setPaused(!session.isPaused)}
            >
              {session.isPaused ? 'Start Draft' : 'Pause Draft'}
            </Button>
          )}
          {session ? (
            <select
              className="rounded-md border border-border bg-white px-2 py-2 text-xs sm:text-sm"
              value={speed}
              onChange={(event) => setSpeed(event.target.value as DraftSpeed)}
            >
              {SPEED_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  Speed: {option}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {!session ? (
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Start a draft to view picks, prospects, and trades.
          </p>
        </div>
      ) : session.status === 'completed' ? (
        <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Draft Complete</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === 'real' ? 'Draft results saved to your roster.' : 'Mock draft finalized.'}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-slate-50 px-6 py-4 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Draft Grade
              </p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {getDraftGrade(userSelections.map((player) => player.rank ?? 100))}
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {userSelections.map((player) => (
              <div
                key={player.id}
                className="rounded-xl border border-border bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-sm font-semibold text-foreground">{formatName(player)}</p>
                <p className="text-xs text-muted-foreground">
                  {player.position} · Rank {player.rank ?? '--'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Draft Board</h2>
              <span className="text-xs text-muted-foreground">
                Pick {session.currentPickIndex + 1} of {session.picks.length}
              </span>
            </div>
            <div className="mt-4 space-y-3">
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
            <div className="flex flex-wrap items-center gap-2">
              {(['draft', 'trade', 'analysis'] as DraftTab[]).map((tab) => (
                <Button
                  key={tab}
                  type="button"
                  variant={activeTab === tab ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-full px-4"
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'draft' ? 'Draft a Player' : tab === 'trade' ? 'Trade' : 'Analysis'}
                </Button>
              ))}
            </div>

            {activeTab === 'draft' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Prospect Board</h2>
                      <p className="text-sm text-muted-foreground">
                        {onClock
                          ? 'You are on the clock — select your next pick.'
                          : 'Waiting for the next user pick.'}
                      </p>
                    </div>
                    {currentPick ? (
                      <div className="rounded-xl border border-border bg-slate-50 px-4 py-3 text-center">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Current pick
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {currentPick.ownerTeamAbbr} · Pick {currentPick.overall}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
                <PlayerTable
                  data={session.prospects}
                  variant="draft"
                  onDraftPlayer={onClock ? handleDraftPlayer : undefined}
                  onTheClockForUserTeam={onClock}
                />
              </div>
            )}

            {activeTab === 'trade' && (
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Trade Center</h2>
                    <p className="text-sm text-muted-foreground">
                      Build a picks-only deal and see acceptance in real time.
                    </p>
                  </div>
                  <select
                    className="rounded-md border border-border bg-white px-2 py-2 text-xs sm:text-sm"
                    value={partnerTeamAbbr}
                    onChange={(event) => {
                      setPartnerTeamAbbr(event.target.value);
                      setSendPickIds([]);
                      setReceivePickIds([]);
                    }}
                  >
                    {availableTeams
                      .filter((abbr) => abbr !== session.userTeamAbbr)
                      .map((abbr) => (
                        <option key={abbr} value={abbr}>
                          {abbr}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                        <p className="text-xs text-muted-foreground">No tradable picks.</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      You receive
                    </p>
                    <div className="mt-2 space-y-2">
                      {partnerTeamAbbr &&
                        availablePicks(partnerTeamAbbr).map((pick) => (
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
                      {partnerTeamAbbr && availablePicks(partnerTeamAbbr).length === 0 && (
                        <p className="text-xs text-muted-foreground">No tradable picks.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-border bg-slate-50 px-4 py-3">
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

                <Button
                  type="button"
                  className="mt-4"
                  onClick={handleTrade}
                  disabled={!tradeAllowed}
                >
                  {mode === 'mock' ? 'Propose trade' : 'Trades disabled in real mode'}
                </Button>
              </div>
            )}

            {activeTab === 'analysis' && (
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <h2 className="text-lg font-semibold text-foreground">Draft Analysis</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Analysis insights will appear here soon.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}

export default function DraftRoomPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DraftRoomContent />
    </Suspense>
  );
}
