'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import AppShell from '@/components/app-shell';
import { ActiveDraftRoom, type DraftSpeedLevel } from '@/components/draft/active-draft-room';
import { DraftOrderPanel } from '@/components/draft/draft-order-panel';
import { DraftStagePanel } from '@/components/draft/draft-stage-panel';
import { buildRoundOneOrder } from '@/components/draft/draft-utils';
import { Button } from '@/components/ui/button';
import { useSaveStore } from '@/features/save/save-store';
import { getDraftGrade } from '@/lib/draft-utils';
import type { DraftMode, DraftPickDTO, DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';

export const dynamic = 'force-dynamic';

type DraftSessionResponse = { ok: true; session: DraftSessionDTO } | { ok: false; error: string };

type DraftPickResponse = { ok: true; session: DraftSessionDTO } | { ok: false; error: string };

type DraftSessionStartResponse =
  | { ok: true; draftSessionId: string; session?: DraftSessionDTO }
  | { ok: false; error: string };

type ActiveDraftSessionResponse =
  | { ok: true; session: DraftSessionDTO | null }
  | { ok: false; error: string };

type DraftGradeResult = {
  grade: string;
  headline: string;
  detail: string;
};

type TeamsResponse = {
  ok: true;
  teams: Array<{ abbr: string; name: string; logoUrl: string; colors: string[] }>;
};

const formatName = (player: PlayerRowDTO) => `${player.firstName} ${player.lastName}`;

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
  const [speedLevel, setSpeedLevel] = React.useState<DraftSpeedLevel>(1);
  const [gradeResult, setGradeResult] = React.useState<DraftGradeResult | null>(null);
  const [isGradeOpen, setIsGradeOpen] = React.useState(false);
  const [teams, setTeams] = React.useState<TeamsResponse['teams']>([]);
  const [selectedPickNumber, setSelectedPickNumber] = React.useState(1);
  const [onTheClockPickNumber] = React.useState(1);
  const [lobbyMessage, setLobbyMessage] = React.useState('');

  const saveId = useSaveStore((state) => state.saveId);
  const activeDraftSessionId = useSaveStore((state) => state.activeDraftSessionId);
  const setActiveDraftSessionId = useSaveStore((state) => state.setActiveDraftSessionId);
  const refreshSaveHeader = useSaveStore((state) => state.refreshSaveHeader);

  const currentPick = session?.picks[session.currentPickIndex];

  const userSelections = React.useMemo(() => {
    if (!session) {
      return [];
    }
    return session.picks
      .filter((pick) => pick.selectedByTeamAbbr === session.userTeamAbbr && pick.selectedPlayerId)
      .map((pick) => session.prospects.find((player) => player.id === pick.selectedPlayerId))
      .filter((player): player is PlayerRowDTO => Boolean(player));
  }, [session]);

  const roundOneOrder = React.useMemo(() => buildRoundOneOrder(teams), [teams]);

  const selectedPick = React.useMemo(
    () =>
      roundOneOrder.find((pick) => pick.pickNumber === selectedPickNumber) ??
      roundOneOrder[0] ??
      null,
    [roundOneOrder, selectedPickNumber],
  );

  const fetchSession = React.useCallback(
    async (draftSessionId: string) => {
      if (!saveId) {
        setError('Select a team to start a save.');
        return null;
      }
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ draftSessionId, saveId });
      const response = await fetch(`/api/draft/session?${query.toString()}`);
      const payload = (await response.json()) as DraftSessionResponse;
      if (!response.ok || !payload.ok) {
        const message = payload.ok ? 'Unable to load draft data.' : payload.error;
        if (message === 'Draft session not found') {
          setActiveDraftSessionId(null, saveId);
          setSession(null);
          setError('');
          setLoading(false);
          return null;
        }
        setError(message);
        setLoading(false);
        return null;
      } else {
        setSession(payload.session);
      }
      setLoading(false);
      return payload.session;
    },
    [saveId, setActiveDraftSessionId],
  );

  const startDraft = React.useCallback(async () => {
    if (!saveId) {
      setError('Select a team to start a save.');
      return false;
    }
    setLoading(true);
    setError('');
    setLobbyMessage('');
    const response = await fetch('/api/draft/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId, mode }),
    });
    const payload = (await response.json()) as DraftSessionStartResponse;
    if (!response.ok || !payload.ok) {
      setLobbyMessage(payload.ok ? 'Unable to start draft.' : payload.error);
      setLoading(false);
      return false;
    }
    setActiveDraftSessionId(payload.draftSessionId, saveId);
    if (payload.session) {
      setSession(payload.session);
    } else {
      await fetchSession(payload.draftSessionId);
    }
    setLoading(false);
    return true;
  }, [fetchSession, mode, saveId, setActiveDraftSessionId]);

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

  React.useEffect(() => {
    if (activeDraftSessionId) {
      void fetchSession(activeDraftSessionId);
    }
  }, [activeDraftSessionId, fetchSession]);

  React.useEffect(() => {
    const loadTeams = async () => {
      const response = await fetch('/api/teams');
      const payload = (await response.json()) as TeamsResponse;
      if (!response.ok || !payload.ok) {
        return;
      }
      setTeams(payload.teams);
    };

    void loadTeams();
  }, []);

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
        setSession(null);
        setError('');
        return;
      }

      setSession(payload.session);
      setActiveDraftSessionId(payload.session?.id ?? null, saveId);
      setLoading(false);
    };

    void restoreActiveSession();
  }, [activeDraftSessionId, saveId, setActiveDraftSessionId]);

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
          {!session ? (
            <Button type="button" onClick={startDraft}>
              Start Draft
            </Button>
          ) : null}
        </div>
      </div>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      {!session ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          {selectedPick ? (
            <div className="order-2 lg:order-1">
              <DraftOrderPanel
                picks={roundOneOrder}
                selectedPickNumber={selectedPickNumber}
                onTheClockPickNumber={onTheClockPickNumber}
                onSelectPick={setSelectedPickNumber}
              />
            </div>
          ) : null}
          {selectedPick ? (
            <div className="order-1 lg:order-2">
              <DraftStagePanel
                selectedPick={selectedPick}
                onTheClockPickNumber={onTheClockPickNumber}
                onStartDraft={() => void startDraft()}
                isStartingDraft={loading}
              />
              {lobbyMessage ? <p className="mt-3 text-sm text-muted-foreground">{lobbyMessage}</p> : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
              <p className="text-sm text-muted-foreground">Loading draft order...</p>
            </div>
          )}
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
        <ActiveDraftRoom
          session={session}
          speedLevel={speedLevel}
          onSpeedChange={setSpeedLevel}
          onTogglePause={() => void setPaused(!session.isPaused)}
          onDraftPlayer={handleDraftPlayer}
        />
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
